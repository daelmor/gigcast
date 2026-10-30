import type { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
	audiencesResponseSchema,
	audienceTypesResponseSchema,
	compareResponseSchema,
	demographicsResponseSchema,
	entitiesResponseSchema,
	entityInsightsResponseSchema,
	extractErrorMessage,
	heatmapLocalityResponseSchema,
	heatmapResponseSchema,
	searchResponseSchema,
	tagId,
	tagInsightsResponseSchema,
	tagsResponseSchema,
	trendingResponseSchema
} from './schemas.ts';
import { loadSamples, type Sample } from './test-support.ts';

const samples = loadSamples();
const byId = (id: string): Sample => {
	const sample = samples.find((s) => s.id === id);
	if (!sample) throw new Error(`missing sample ${id}`);
	return sample;
};

/** Schema for a status-200 sample, chosen by id prefix. Undefined means "no decision made yet". */
function schemaFor(sample: Sample): z.ZodType | undefined {
	const { id } = sample;
	if (id === 'heatmap.boundary-urn-locality') return heatmapLocalityResponseSchema;
	if (id === 'auth.hackathon' || id.startsWith('search.')) return searchResponseSchema;
	if (
		id.startsWith('places.') ||
		id.startsWith('similar.') ||
		id.startsWith('brands.') ||
		id.startsWith('cityartists.') ||
		id === 'trends.bias'
	) {
		return entityInsightsResponseSchema;
	}
	if (id.startsWith('heatmap.')) return heatmapResponseSchema;
	if (id.startsWith('demographics.')) return demographicsResponseSchema;
	if (id === 'tags.anchor' || id.startsWith('citytags.')) return tagInsightsResponseSchema;
	if (id.startsWith('tags.place.') || id.startsWith('tags.music.')) return tagsResponseSchema;
	if (id.startsWith('trending.')) return trendingResponseSchema;
	if (id.startsWith('compare.')) return compareResponseSchema;
	if (id.startsWith('entities.')) return entitiesResponseSchema;
	if (id === 'audiences.types') return audienceTypesResponseSchema;
	if (id === 'audiences.list') return audiencesResponseSchema;
	return undefined;
}

describe('response schemas parse every recorded 200 sample', () => {
	const ok = samples.filter((s) => s.status === 200);

	it('has status-200 samples', () => {
		expect(ok.length).toBeGreaterThan(15);
	});

	it('has a schema mapping for every status-200 sample', () => {
		const unmapped = ok.filter((s) => schemaFor(s) === undefined).map((s) => s.id);
		expect(unmapped).toEqual([]);
	});

	it.each(ok.map((s) => [s.id, s] as const))('%s', (_id, sample) => {
		const schema = schemaFor(sample);
		expect(schema).toBeDefined();
		const result = schema!.safeParse(sample.body);
		expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
	});

	it('does not map the non-200 samples', () => {
		const bad = samples.filter((s) => s.status !== 200);
		expect(bad.map((s) => s.id).sort()).toEqual(['auth.production', 'compare.artist-vs-city']);
	});

	it('keeps unknown fields (loose objects)', () => {
		const parsed = searchResponseSchema.parse(byId('auth.hackathon').body);
		expect(parsed.results[0]).toHaveProperty('properties');
	});

	it('rejects a body of the wrong shape', () => {
		expect(searchResponseSchema.safeParse({ results: 'nope' }).success).toBe(false);
		expect(entityInsightsResponseSchema.safeParse({ results: {} }).success).toBe(false);
		expect(searchResponseSchema.safeParse({}).success).toBe(false);
	});
});

describe('extractErrorMessage', () => {
	it('reads the recorded 401 body', () => {
		expect(extractErrorMessage(byId('auth.production').body)).toBe('Unauthorized');
	});

	it('reads the recorded 400 body', () => {
		expect(extractErrorMessage(byId('compare.artist-vs-city').body)).toBe(
			'b.signal.interests.entities is required'
		);
	});

	it('handles the three observed shapes', () => {
		expect(extractErrorMessage({ errors: [{ message: 'a' }, { message: 'b' }] })).toBe('a; b');
		expect(extractErrorMessage({ error: { message: 'm', reason: 'r', code: 400 } })).toBe('m');
		expect(extractErrorMessage({ error: { reason: 'only reason' } })).toBe('only reason');
		expect(extractErrorMessage({ message: 'plain' })).toBe('plain');
	});

	it('truncates string bodies and returns undefined for unrecognizable ones', () => {
		expect(extractErrorMessage('x'.repeat(500))).toHaveLength(300);
		expect(extractErrorMessage('')).toBeUndefined();
		expect(extractErrorMessage({})).toBeUndefined();
		expect(extractErrorMessage(null)).toBeUndefined();
	});
});

describe('tagId', () => {
	it('uses id when present', () => {
		const tag = tagsResponseSchema.parse(byId('tags.place.bar').body).results.tags[0];
		expect(tagId(tag)).toBe(tag.id);
		expect(typeof tagId(tag)).toBe('string');
	});

	it('uses tag_id when there is no id', () => {
		const tag = tagInsightsResponseSchema.parse(byId('tags.anchor').body).results.tags[0];
		expect(tagId(tag)).toBe(tag.tag_id);
		expect(typeof tagId(tag)).toBe('string');
	});

	it('prefers id over tag_id and returns undefined with neither', () => {
		expect(tagId({ id: 'a', tag_id: 'b', name: 'n' })).toBe('a');
		expect(tagId({ name: 'n' })).toBeUndefined();
	});
});

describe('heatmap with dimensions', () => {
	it('exposes price_level_affinity on the first cell query', () => {
		const parsed = heatmapResponseSchema.parse(byId('heatmap.dimensions').body);
		const cell = parsed.results.heatmap[0];
		expect(typeof cell.query.price_level_affinity).toBe('number');
		expect(cell.query).toHaveProperty('quality_affinity');
		expect(cell.query).toHaveProperty('popularity_affinity');
	});
});
