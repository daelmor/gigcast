import { describe, expect, it } from 'vitest';
import {
	dedupeNeighbourhoods,
	FLAT_SPREAD,
	normalizeNeighbourhoodName,
	rankNeighbourhoods
} from './neighbourhoods.ts';

const n = (entityId: string, name: string, affinity: number) => ({ entityId, name, affinity });

describe('dedupeNeighbourhoods', () => {
	it('keeps one entry per entity id and per normalized name, the highest affinity', () => {
		const out = dedupeNeighbourhoods([
			n('a', 'Brooklyn', 0.985),
			n('b', 'Brooklyn', 0.97),
			n('a', 'Brooklyn', 0.5),
			n('c', 'New York', 0.963),
			n('d', 'New  york', 0.956),
			n('e', 'Crown Heights', 0.971),
			n('f', 'Ciudad de México', 0.486),
			n('g', 'Ciudad de Mexico', 0.49)
		]);
		expect(out.map((x) => `${x.name}=${x.affinity}`)).toEqual([
			'Brooklyn=0.985',
			'Crown Heights=0.971',
			'New York=0.963',
			'Ciudad de Mexico=0.49'
		]);
	});

	it('normalizes accents, case and punctuation', () => {
		expect(normalizeNeighbourhoodName('Town "n" Country')).toBe('town n country');
		expect(normalizeNeighbourhoodName('São Paulo')).toBe('sao paulo');
	});
});

describe('rankNeighbourhoods', () => {
	it('returns a ranked list when the top affinities differ', () => {
		const r = rankNeighbourhoods([
			n('1', 'Downey', 1),
			n('2', 'South Gate', 0.983),
			n('3', 'Huntington Park', 0.967),
			n('4', 'Pico Rivera', 0.95)
		]);
		expect(r.flat).toBe(false);
		expect(r.items.map((x) => x.name)).toEqual([
			'Downey',
			'South Gate',
			'Huntington Park',
			'Pico Rivera'
		]);
		expect(r.spread).toBeCloseTo(0.05);
	});

	it('flags broad coverage when the shown affinities are within 0.02', () => {
		const items = Array.from({ length: 15 }, (_, i) => n(String(i), `Comuna ${i}`, 0.804));
		const r = rankNeighbourhoods(items);
		expect(r.flat).toBe(true);
		expect(r.items).toHaveLength(8);
		expect(r.spread).toBe(0);
		// Only the shown top N counts: a long tail far below does not make it ranked.
		const withTail = [...items.slice(0, 8), n('tail', 'Far away', 0.2)];
		expect(rankNeighbourhoods(withTail).flat).toBe(true);
		expect(rankNeighbourhoods(withTail, 9).flat).toBe(false);
		expect(FLAT_SPREAD).toBe(0.02);
	});

	it('never calls a single item flat', () => {
		expect(rankNeighbourhoods([n('1', 'Only', 0.5)]).flat).toBe(false);
		expect(rankNeighbourhoods([])).toEqual({ items: [], flat: false, spread: 0 });
	});
});
