import { describe, expect, it } from 'vitest';
import { toArtistResult, toLocalityResults } from './map.ts';
import type { SearchResult } from '../qloo/schemas.ts';

const base = { name: 'Gaby Moreno', entity_id: 'A1' } as SearchResult;

describe('toArtistResult', () => {
	it('maps the basic fields and caps tags at five', () => {
		const r = toArtistResult({
			...base,
			disambiguation: 'Singer',
			popularity: 0.42,
			properties: { image: { url: 'https://img/x.jpg' } },
			tags: Array.from({ length: 7 }, (_, i) => ({ name: `t${i}`, id: `i${i}` }))
		} as unknown as SearchResult);
		expect(r).toMatchObject({
			entityId: 'A1',
			name: 'Gaby Moreno',
			disambiguation: 'Singer',
			popularity: 0.42,
			image: 'https://img/x.jpg'
		});
		expect(r.tags).toEqual(['t0', 't1', 't2', 't3', 't4']);
	});

	it('tolerates missing and malformed optional fields', () => {
		const r = toArtistResult({
			...base,
			disambiguation: null,
			properties: { image: { url: 12 } }
		} as unknown as SearchResult);
		expect(r.disambiguation).toBeUndefined();
		expect(r.image).toBeUndefined();
		expect(r.popularity).toBeNull();
		expect(r.tags).toEqual([]);
	});
});

describe('toLocalityResults', () => {
	it('keeps every candidate and puts acceptable ones first', () => {
		const out = toLocalityResults([
			{ entityId: '1', name: 'Panama City', disambiguation: 'Florida', acceptable: false },
			{ entityId: '2', name: 'Distrito Panamá', lat: 8.9, lon: -79.5, acceptable: true },
			{ entityId: '3', name: 'Colón', acceptable: true }
		]);
		expect(out.map((c) => c.entityId)).toEqual(['2', '3', '1']);
		expect(out[0]).toEqual({
			entityId: '2',
			name: 'Distrito Panamá',
			disambiguation: undefined,
			lat: 8.9,
			lon: -79.5,
			acceptable: true
		});
	});
});
