import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, filterItems } from './filter';
import type { ClassifiedNews } from '$lib/brief/schema';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function item(over: Partial<ClassifiedNews>): ClassifiedNews {
	return {
		id: 'x',
		title: 't',
		url: 'https://example.com',
		source: null,
		publishedAt: day(1),
		snippet: null,
		category: 'security',
		severity: 3,
		timeHorizon: 'ongoing',
		confidence: 0.8,
		soWhat: 's',
		affectedEntities: [],
		weight: 0.5,
		mentionsSubject: false,
		...over
	};
}

const items = [
	item({ id: 'a', category: 'security', severity: 4, publishedAt: day(2) }),
	item({
		id: 'b',
		category: 'transport',
		severity: 2,
		publishedAt: day(20),
		mentionsSubject: true
	}),
	item({ id: 'c', category: 'health', severity: 5, publishedAt: day(50) }),
	item({ id: 'd', category: 'health', severity: 1, publishedAt: null })
];
const ids = (r: ClassifiedNews[]) => r.map((i) => i.id);

describe('filterItems', () => {
	it('keeps everything with the defaults', () => {
		expect(ids(filterItems(items, DEFAULT_FILTERS, NOW))).toEqual(['a', 'b', 'c', 'd']);
	});
	it('filters by category', () => {
		const r = filterItems(items, { ...DEFAULT_FILTERS, categories: ['health'] }, NOW);
		expect(ids(r)).toEqual(['c', 'd']);
	});
	it('filters by minimum severity', () => {
		const r = filterItems(items, { ...DEFAULT_FILTERS, minSeverity: 4 }, NOW);
		expect(ids(r)).toEqual(['a', 'c']);
	});
	it('filters by days window and keeps undated items', () => {
		expect(ids(filterItems(items, { ...DEFAULT_FILTERS, days: 7 }, NOW))).toEqual(['a', 'd']);
		expect(ids(filterItems(items, { ...DEFAULT_FILTERS, days: 30 }, NOW))).toEqual(['a', 'b', 'd']);
	});
	it('filters to subject mentions', () => {
		const r = filterItems(items, { ...DEFAULT_FILTERS, mentionsSubjectOnly: true }, NOW);
		expect(ids(r)).toEqual(['b']);
	});
	it('combines filters and does not mutate the input', () => {
		const copy = [...items];
		const r = filterItems(
			items,
			{ categories: ['health'], minSeverity: 3, days: 60, mentionsSubjectOnly: false },
			NOW
		);
		expect(ids(r)).toEqual(['c']);
		expect(items).toEqual(copy);
	});
});
