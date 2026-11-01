import { describe, expect, it } from 'vitest';
import {
	feedUrlKeys,
	isCalendarContextItem,
	isCalendarSourceUrl,
	splitCalendarRiskItems,
	urlKey
} from './risk-items.ts';
import type { RiskItem } from './schema.ts';

const item = (over: Partial<RiskItem>): RiskItem => ({
	category: 'security',
	severity: 3,
	title: 'Something',
	soWhat: 'Do something.',
	sourceName: 'Source',
	sourceUrl: 'https://example.com/a',
	label: 'grounded',
	...over
});

describe('urlKey', () => {
	it('ignores scheme, www, hash and a trailing slash', () => {
		expect(urlKey('https://www.Example.com/a/')).toBe('example.com/a');
		expect(urlKey('http://example.com/a#x')).toBe('example.com/a');
		expect(urlKey('not a url')).toBe('not a url');
	});
});

describe('isCalendarSourceUrl', () => {
	it('recognises the calendar and climate hosts', () => {
		expect(isCalendarSourceUrl('https://open-meteo.com')).toBe(true);
		expect(isCalendarSourceUrl('https://archive-api.open-meteo.com/v1/era5')).toBe(true);
		expect(isCalendarSourceUrl('https://date.nager.at/')).toBe(true);
		expect(isCalendarSourceUrl('https://www.latimes.com/weather')).toBe(false);
	});
});

describe('isCalendarContextItem', () => {
	const known = feedUrlKeys({
		items: [{ url: 'https://www.latimes.com/story' }],
		advisories: [{ url: 'https://travel.state.gov/x' }]
	});

	it('drops Open-Meteo and Nager.Date items whatever their category', () => {
		expect(
			isCalendarContextItem(
				item({ category: 'competing_events', sourceUrl: 'https://date.nager.at' }),
				known
			)
		).toBe(true);
		expect(
			isCalendarContextItem(
				item({ category: 'weather_climate', sourceUrl: 'https://open-meteo.com/' }),
				known
			)
		).toBe(true);
	});

	it('drops weather items with no feed url, keeps weather items the feed returned', () => {
		expect(
			isCalendarContextItem(
				item({ category: 'weather_climate', sourceUrl: 'https://somewhere.else/forecast' }),
				known
			)
		).toBe(true);
		expect(
			isCalendarContextItem(
				item({ category: 'weather_climate', sourceUrl: 'https://latimes.com/story/' }),
				known
			)
		).toBe(false);
	});

	it('without a recorded feed only the calendar hosts decide', () => {
		expect(
			isCalendarContextItem(
				item({ category: 'weather_climate', sourceUrl: 'https://news.example.com/rain' }),
				undefined
			)
		).toBe(false);
		expect(isCalendarContextItem(item({ sourceUrl: 'https://open-meteo.com' }), undefined)).toBe(
			true
		);
	});

	it('splits a list into kept and dropped', () => {
		const climate = item({ category: 'weather_climate', sourceUrl: 'https://open-meteo.com' });
		const news = item({ sourceUrl: 'https://travel.state.gov/x' });
		expect(splitCalendarRiskItems([climate, news], known)).toEqual({
			kept: [news],
			dropped: [climate]
		});
	});
});
