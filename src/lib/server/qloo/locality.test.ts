import { describe, expect, it } from 'vitest';
import { QlooClient } from './client.ts';
import {
	candidateFromSearch,
	countryHintsFor,
	defaultRejectHints,
	localityQueries,
	normalizeText,
	pickLocality,
	resolveLocality,
	type LocalityCriteria
} from './locality.ts';
import { cacheKey } from './params.ts';
import type { SearchResult } from './schemas.ts';
import { cachedResponseFor, replayClient, seedStore } from './test-support.ts';

const result = (name: string, disambiguation: string, id = name): SearchResult => ({
	name,
	entity_id: id,
	disambiguation
});

const searchSample = (query: string, results: SearchResult[]) => ({
	endpoint: '/search',
	params: { query, types: 'urn:entity:locality', take: 5 },
	status: 200,
	body: { results }
});

describe('normalizeText', () => {
	it('lower-cases, strips accents and punctuation', () => {
		expect(normalizeText('Ciudad de Panamá')).toBe('ciudad de panama');
		expect(normalizeText('  São Paulo, Brasil! ')).toBe('sao paulo brasil');
		expect(normalizeText('Miami-Dade')).toBe('miami dade');
	});
});

describe('country hints', () => {
	it('maps codes and names', () => {
		expect(countryHintsFor('PA')).toEqual(['panama']);
		expect(countryHintsFor('pa')).toEqual(['panama']);
		expect(countryHintsFor('Guatemala')).toEqual(['guatemala']);
		expect(countryHintsFor('República Dominicana')).toEqual(['republica dominicana']);
	});

	it('rejects the United States by default except for the US itself', () => {
		expect(defaultRejectHints('GT')).toEqual(['united states']);
		expect(defaultRejectHints('US')).toEqual([]);
		expect(defaultRejectHints('United States')).toEqual([]);
	});
});

describe('Panama City trap', () => {
	const criteria: LocalityCriteria = {
		cityName: 'Distrito Panamá',
		countryHints: countryHintsFor('PA'),
		rejectHints: defaultRejectHints('PA')
	};
	const candidates = [
		result(
			'Panama City Beach',
			'Panama City Beach, Bay, Florida, United States of America',
			'beach'
		),
		result('Panama City', 'Panama City, Bay, Florida, United States of America', 'fl'),
		result('Distrito Panamá', 'Distrito Panamá, Provincia de Panamá, Panama', 'pa')
	].map((r) => candidateFromSearch(r, criteria));

	it('builds the expected criteria', () => {
		expect(criteria.countryHints).toEqual(['panama']);
		expect(criteria.rejectHints).toEqual(['united states']);
		expect(criteria.cityName).toBe('Distrito Panamá');
	});

	it('marks the Florida namesakes as unacceptable', () => {
		expect(candidates.map((c) => c.acceptable)).toEqual([false, false, true]);
	});

	it('picks Distrito Panamá', () => {
		const pick = pickLocality(candidates, criteria);
		expect(pick?.entityId).toBe('pa');
		expect(pick?.name).toBe('Distrito Panamá');
	});

	it('returns undefined when nothing is acceptable', () => {
		expect(pickLocality(candidates.slice(0, 2), criteria)).toBeUndefined();
	});

	it('carries coordinates and popularity through', () => {
		const c = candidateFromSearch(
			{
				name: 'Guatemala City',
				entity_id: 'g',
				disambiguation: null,
				popularity: 0.5,
				location: { lat: 14.6, lon: -90.5 }
			},
			{ countryHints: ['guatemala'] }
		);
		// no disambiguation: only the name is checked, "guatemala" is in it
		expect(c).toMatchObject({ lat: 14.6, lon: -90.5, popularity: 0.5, acceptable: true });
		expect(c.disambiguation).toBeUndefined();
	});
});

describe('pickLocality', () => {
	const criteria: LocalityCriteria = {
		cityName: 'Miami',
		countryHints: countryHintsFor('US')
	};
	const miamiDade = candidateFromSearch(
		result('Miami-Dade', 'Miami-Dade, Florida, United States of America'),
		criteria
	);
	const miami = candidateFromSearch(
		result('Miami', 'Miami, Miami-Dade, Florida, United States of America'),
		criteria
	);

	it('prefers the exact city name over an earlier acceptable candidate', () => {
		expect(pickLocality([miamiDade, miami], criteria)?.name).toBe('Miami');
	});

	it('falls back to the first acceptable candidate without a cityName', () => {
		expect(pickLocality([miamiDade, miami], { countryHints: ['united states'] })?.name).toBe(
			'Miami-Dade'
		);
	});

	it('falls back to the first acceptable candidate when no name matches exactly', () => {
		expect(pickLocality([miamiDade, miami], { ...criteria, cityName: 'Orlando' })?.name).toBe(
			'Miami-Dade'
		);
	});
});

describe('resolveLocality', () => {
	const guatemala = result(
		'Guatemala City',
		'Guatemala City, Departamento de Guatemala, Guatemala',
		'3E843C82-ACFE-48BB-9C76-FC9A2781530D'
	);
	const criteria: LocalityCriteria = {
		cityName: 'Guatemala City',
		countryHints: countryHintsFor('GT'),
		rejectHints: defaultRejectHints('GT')
	};

	it('resolves from a seeded search and records the query used', async () => {
		const query = 'Guatemala City, Guatemala';
		// No locality.guatemala-city sample exists, so seed a synthetic /search response.
		const sample = searchSample(query, [guatemala]);
		const client = new QlooClient({
			mode: 'replay',
			store: seedStore([{ id: 'locality.guatemala-city', ...sample }])
		});
		const resolved = await resolveLocality(client, [query], criteria);
		expect(resolved?.entityId).toBe('3E843C82-ACFE-48BB-9C76-FC9A2781530D');
		expect(resolved?.name).toBe('Guatemala City');
		expect(resolved?.query).toBe(query);
		expect(resolved?.source.key).toBe(
			cacheKey('/search', { query, types: 'urn:entity:locality', take: 5 })
		);
		expect(resolved?.candidates).toHaveLength(1);
	});

	it('tries the next query when the first has no acceptable candidate', async () => {
		const florida = result(
			'Panama City',
			'Panama City, Bay, Florida, United States of America',
			'fl'
		);
		const district = result(
			'Distrito Panamá',
			'Distrito Panamá, Provincia de Panamá, Panama',
			'pa'
		);
		const client = replayClient([
			{ id: 'a', ...searchSample('Panama City, Panama', [florida]) },
			{ id: 'b', ...searchSample('Distrito Panamá', [district]) }
		]);
		const resolved = await resolveLocality(client, ['Panama City, Panama', 'Distrito Panamá'], {
			cityName: 'Distrito Panamá',
			countryHints: countryHintsFor('PA'),
			rejectHints: defaultRejectHints('PA')
		});
		expect(resolved?.entityId).toBe('pa');
		expect(resolved?.query).toBe('Distrito Panamá');
		expect(resolved?.candidates.map((c) => c.entityId)).toEqual(['fl', 'pa']);
	});

	it('returns undefined when no query yields an acceptable candidate', async () => {
		const florida = result('Panama City', 'Panama City, Bay, Florida, United States of America');
		const entry = cachedResponseFor(searchSample('Panama City', [florida]));
		const store = seedStore([]);
		await store.set(entry);
		const client = new QlooClient({ mode: 'replay', store });
		const resolved = await resolveLocality(client, ['Panama City'], {
			countryHints: ['panama'],
			rejectHints: ['united states']
		});
		expect(resolved).toBeUndefined();
	});
});

describe('localityQueries', () => {
	it('starts with the district name for Panama City', () => {
		const queries = localityQueries('Panama City', 'PA');
		expect(queries[0]).toBe('Distrito Panamá');
		expect(new Set(queries).size).toBe(queries.length);
	});

	it('includes the Spanish name for Mexico City', () => {
		expect(localityQueries('Mexico City', 'MX')).toContain('Ciudad de México');
	});

	it('includes the Spanish name for Guatemala City and always the bare city', () => {
		const queries = localityQueries('Guatemala City', 'GT');
		expect(queries).toContain('Ciudad de Guatemala');
		expect(queries).toContain('Guatemala City');
	});

	it('uses only "city, country" and the bare city for other places', () => {
		expect(localityQueries('Lima', 'Peru')).toEqual(['Lima, Peru', 'Lima']);
	});
});
