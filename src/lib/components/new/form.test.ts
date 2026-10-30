import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBriefRequestSchema } from '$lib/api/contracts';
import {
	COUNTRIES,
	buildPayload,
	debounce,
	defaultDates,
	emptyForm,
	validateDates
} from './form.ts';

afterEach(() => vi.useRealTimers());

describe('debounce', () => {
	it('fires once with the last arguments', () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const d = debounce(fn, 300);
		d('a');
		vi.advanceTimersByTime(200);
		d('b');
		vi.advanceTimersByTime(299);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('b');
	});

	it('can be cancelled', () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const d = debounce(fn, 100);
		d();
		d.cancel();
		vi.advanceTimersByTime(500);
		expect(fn).not.toHaveBeenCalled();
	});
});

describe('dates', () => {
	const today = new Date(2026, 10, 15); // 15 Nov 2026, local

	it('defaults to today+60 and today+62', () => {
		expect(defaultDates(today)).toEqual({ dateFrom: '2027-01-14', dateTo: '2027-01-16' });
	});

	it('validates ordering and past dates', () => {
		expect(validateDates('2026-11-15', '2026-11-16', today)).toEqual({});
		expect(validateDates('2026-11-14', '2026-11-16', today).dateFrom).toBeDefined();
		expect(validateDates('2026-12-02', '2026-12-01', today).dateTo).toBeDefined();
		expect(validateDates('', '', today)).toEqual({
			dateFrom: expect.any(String),
			dateTo: expect.any(String)
		});
	});
});

describe('COUNTRIES', () => {
	it('has unique two-letter codes', () => {
		const codes = COUNTRIES.map((c) => c.code);
		expect(new Set(codes).size).toBe(codes.length);
		expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
		expect(codes).toEqual(expect.arrayContaining(['GT', 'ES', 'PT', 'MX']));
	});
});

describe('buildPayload', () => {
	const base = () => ({
		...emptyForm(new Date(2026, 10, 15)),
		artist: ' Gaby Moreno ',
		city: 'Guatemala City',
		country: 'GT'
	});

	it('omits everything that was not filled', () => {
		const payload = buildPayload(base());
		expect(payload).toEqual({
			artist: 'Gaby Moreno',
			city: 'Guatemala City',
			country: 'GT',
			dateFrom: '2027-01-14',
			dateTo: '2027-01-16'
		});
		expect(createBriefRequestSchema.safeParse(payload).success).toBe(true);
	});

	it('includes ids and only filled promoter values', () => {
		const f = base();
		f.artistEntityId = 'A1';
		f.localityEntityId = 'L1';
		f.localityName = 'Ciudad de Guatemala';
		f.marketId = 'guatemala-city';
		f.venues = [
			{ name: 'Teatro Nacional', capacity: '1200' },
			{ name: '', capacity: '500' }
		];
		f.priceMin = '20';
		f.priceMax = '80';
		f.priceCurrency = 'usd';
		f.sales = [
			{ event: 'Show 1', date: '', sold: '900', capacity: '' },
			{ event: '', date: '', sold: '5', capacity: '' }
		];
		f.notes = '  ';
		const payload = buildPayload(f);
		expect(payload.promoter).toEqual({
			venues: [{ name: 'Teatro Nacional', capacity: 1200 }],
			ticketPriceRange: { min: 20, max: 80, currency: 'USD' },
			pastSales: [{ event: 'Show 1', sold: 900 }]
		});
		expect(payload).toMatchObject({
			artistEntityId: 'A1',
			localityEntityId: 'L1',
			localityName: 'Ciudad de Guatemala',
			marketId: 'guatemala-city'
		});
		expect(createBriefRequestSchema.safeParse(payload).success).toBe(true);
	});

	it('fails schema validation without an artist', () => {
		const f = base();
		f.artist = '';
		expect(createBriefRequestSchema.safeParse(buildPayload(f)).success).toBe(false);
	});
});
