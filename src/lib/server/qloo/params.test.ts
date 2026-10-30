import { describe, expect, it } from 'vitest';
import {
	assertAllowedParams,
	cacheKey,
	normalizeParams,
	pointWkt,
	QlooParamError,
	type QlooParams
} from './params.ts';
import { loadSamples } from './test-support.ts';

const place = 'urn:entity:place';

function thrownBy(endpoint: string, params: QlooParams): unknown {
	try {
		assertAllowedParams(endpoint, params);
	} catch (err) {
		return err;
	}
	return undefined;
}

function offendingOf(endpoint: string, params: QlooParams): string[] | undefined {
	const err = thrownBy(endpoint, params);
	if (err === undefined) return undefined;
	expect(err).toBeInstanceOf(QlooParamError);
	return (err as QlooParamError).offending;
}

describe('assertAllowedParams: /v2/insights', () => {
	it('accepts place-only filters on urn:entity:place', () => {
		expect(() =>
			assertAllowedParams('/v2/insights', {
				'filter.type': place,
				'filter.location.query': 'Guatemala City, Guatemala',
				'filter.price_level.min': 2,
				'filter.rating.min': 3.5,
				'filter.tags': 'urn:tag:genre:place:bar'
			})
		).not.toThrow();
	});

	it.each(['urn:entity:artist', 'urn:entity:brand'])(
		'rejects place-only filters on %s and lists exactly the bad keys',
		(type) => {
			const offending = offendingOf('/v2/insights', {
				'filter.type': type,
				'filter.location.query': 'Guatemala City, Guatemala',
				'filter.price_level.min': 2,
				'filter.tags': 'urn:tag:x',
				take: 5
			});
			expect(offending).toEqual(['filter.location.query', 'filter.price_level.min']);
		}
	);

	it('rejects an unknown filter.type', () => {
		expect(offendingOf('/v2/insights', { 'filter.type': 'urn:entity:music' })).toEqual([
			'filter.type'
		]);
	});

	it('rejects a missing filter.type', () => {
		expect(offendingOf('/v2/insights', { take: 5 })).toEqual(['filter.type']);
	});

	it.each([
		'urn:entity:artist',
		'urn:entity:brand',
		'urn:entity:place',
		'urn:entity:destination',
		'urn:heatmap',
		'urn:demographics',
		'urn:tag'
	])('rejects filter.bogus_parameter on %s', (type) => {
		expect(
			offendingOf('/v2/insights', { 'filter.type': type, 'filter.bogus_parameter': 'x' })
		).toEqual(['filter.bogus_parameter']);
	});

	it('accepts heatmap.dimensions and output.heatmap.boundary only on urn:heatmap', () => {
		const heatmapOnly = {
			'heatmap.dimensions': 'quality,popularity',
			'output.heatmap.boundary': 'urn:entity:locality'
		};
		expect(offendingOf('/v2/insights', { 'filter.type': 'urn:heatmap', ...heatmapOnly })).toBe(
			undefined
		);
		for (const type of [place, 'urn:entity:artist', 'urn:tag', 'urn:demographics']) {
			expect(offendingOf('/v2/insights', { 'filter.type': type, ...heatmapOnly })).toEqual([
				'heatmap.dimensions',
				'output.heatmap.boundary'
			]);
		}
	});

	it('ignores keys whose value is undefined', () => {
		expect(() =>
			assertAllowedParams('/v2/insights', {
				'filter.type': 'urn:entity:artist',
				'filter.price_level.min': undefined,
				'filter.bogus_parameter': undefined
			})
		).not.toThrow();
	});
});

describe('assertAllowedParams: other endpoints', () => {
	it('accepts a.* and b.* signals on compare but not c.*', () => {
		expect(() =>
			assertAllowedParams('/v2/insights/compare', {
				'a.signal.interests.entities': 'x',
				'b.signal.location.query': 'Guatemala City, Guatemala',
				'filter.type': 'urn:tag',
				take: 5
			})
		).not.toThrow();
		expect(offendingOf('/v2/insights/compare', { 'c.signal.interests.entities': 'x' })).toEqual([
			'c.signal.interests.entities'
		]);
	});

	it('rejects an a.* key that is not a signal on compare', () => {
		expect(offendingOf('/v2/insights/compare', { 'a.filter.type': 'x' })).toEqual([
			'a.filter.type'
		]);
	});

	it('rejects an unknown endpoint and reports every defined key', () => {
		const err = thrownBy('/v9/nothing', { a: 1, b: undefined, c: 'x' });
		expect(err).toBeInstanceOf(QlooParamError);
		expect((err as QlooParamError).offending).toEqual(['a', 'c']);
		expect((err as QlooParamError).endpoint).toBe('/v9/nothing');
		expect((err as QlooParamError).message).toContain('unknown endpoint');
	});

	it('rejects unknown parameters on /search', () => {
		expect(offendingOf('/search', { query: 'x', types: 'urn:entity:artist', limit: 3 })).toEqual([
			'limit'
		]);
	});
});

describe('normalizeParams / cacheKey / pointWkt', () => {
	it('sorts keys, drops undefined, stringifies booleans and numbers', () => {
		const out = normalizeParams({ z: 1, a: true, m: false, u: undefined, s: 'x', f: 0.5 });
		expect(Object.keys(out)).toEqual(['a', 'f', 'm', 's', 'z']);
		expect(out).toEqual({ a: 'true', f: '0.5', m: 'false', s: 'x', z: '1' });
	});

	it('produces the same key regardless of insertion order', () => {
		const a = cacheKey('/search', { query: 'x', types: 'urn:entity:artist', take: 2 });
		const b = cacheKey('/search', { take: 2, types: 'urn:entity:artist', query: 'x' });
		expect(a).toBe(b);
	});

	it('url-encodes values and omits the "?" when there are no params', () => {
		expect(cacheKey('/search', { query: 'Bad Bunny', types: 'urn:entity:artist' })).toBe(
			'/search?query=Bad+Bunny&types=urn%3Aentity%3Aartist'
		);
		expect(cacheKey('/entities', {})).toBe('/entities');
		expect(cacheKey('/entities', { entity_ids: undefined })).toBe('/entities');
	});

	it('differs when a value differs', () => {
		expect(cacheKey('/search', { take: 2 })).not.toBe(cacheKey('/search', { take: 3 }));
	});

	it('puts longitude first in WKT', () => {
		expect(pointWkt(14.6, -90.5)).toBe('POINT(-90.5 14.6)');
	});
});

describe('recorded samples vs the whitelist', () => {
	const samples = loadSamples();

	it('loads the recorded samples', () => {
		expect(samples.length).toBeGreaterThanOrEqual(24);
	});

	it('rejects exactly the samples the probe sent with bad input', () => {
		const rejected = samples
			.filter((s) => thrownBy(s.endpoint, s.params) !== undefined)
			.map((s) => s.id);
		// The deliberately bad probe requests (errors.type-music, errors.type-food,
		// errors.no-type, params.g1.e9) live only in docs/qloo-probe-log.json, not in
		// docs/qloo-samples. Every recorded sample, including the 400 and 401 ones,
		// uses whitelisted parameters, so the whitelist is as permissive as the real
		// traffic and no more (see the next test).
		expect(rejected).toEqual([]);
	});

	// The bad probe requests, reconstructed from docs/qloo-findings.md.
	it.each([
		['errors.type-music', { 'filter.type': 'urn:entity:music', 'signal.interests.tags': 'x' }],
		['errors.type-food', { 'filter.type': 'urn:entity:food', take: 5 }],
		['errors.no-type', { 'signal.interests.entities': 'x', take: 5 }],
		['params.g1.e9', { 'filter.type': 'urn:entity:artist', 'filter.bogus_parameter': 'x' }]
	])('would reject the probe request %s', (_id, params) => {
		expect(() => assertAllowedParams('/v2/insights', params)).toThrow(QlooParamError);
	});
});
