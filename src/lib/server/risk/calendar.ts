/**
 * Deterministic context for a market and a date window: public holidays and
 * long weekends from Nager.Date, climate for the dates from Open-Meteo's
 * archive (same dates in the previous years) and monthly normals. Everything
 * is cached in Postgres (holidays_cache, weather_cache) because the sources
 * are free and rate limited.
 */
import { eq } from 'drizzle-orm';
import type {
	ClimateMonth,
	ClimateWindow,
	Holiday,
	LongWeekend,
	MarketCalendar
} from '../../brief/schema.ts';
import { getDb } from '../db/index.ts';
import { holidaysCache, weatherCache } from '../db/schema.ts';
import { logger } from '../log.ts';

export interface SourceCall {
	endpoint: string;
	requestKey: string;
	cacheHit: boolean;
	fetchedAt: string;
}

const USER_AGENT = 'gigcast/0.1 (+https://github.com/daelmor/gigcast)';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface NagerHoliday {
	date: string;
	localName: string;
	name: string;
	global?: boolean;
	types?: string[];
}

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
	const res = await fetch(url, {
		headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
	return (await res.json()) as T;
}

export interface CalendarDeps {
	fetchJson?: <T>(url: string) => Promise<T>;
	now?: () => Date;
}

/** Holidays for one country and year, cached for 30 days. */
export async function getHolidays(
	country: string,
	year: number,
	calls: SourceCall[],
	deps: CalendarDeps = {}
): Promise<NagerHoliday[]> {
	const id = `${country.toUpperCase()}-${year}`;
	const endpoint = `date.nager.at/PublicHolidays/${year}/${country.toUpperCase()}`;
	const now = (deps.now ?? (() => new Date()))();
	const db = getDb();
	const cached = await db.select().from(holidaysCache).where(eq(holidaysCache.id, id)).limit(1);
	const fresh = cached[0] && now.getTime() - cached[0].fetchedAt.getTime() < 30 * 86_400_000;
	if (cached[0] && fresh) {
		calls.push({
			endpoint,
			requestKey: id,
			cacheHit: true,
			fetchedAt: cached[0].fetchedAt.toISOString()
		});
		return cached[0].payload as NagerHoliday[];
	}
	const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${country.toUpperCase()}`;
	let payload: NagerHoliday[];
	try {
		payload = await (deps.fetchJson ?? fetchJson)<NagerHoliday[]>(url);
	} catch (err) {
		if (cached[0]) {
			logger.warn({ err, id }, 'holiday refresh failed; serving stale cache');
			calls.push({
				endpoint,
				requestKey: id,
				cacheHit: true,
				fetchedAt: cached[0].fetchedAt.toISOString()
			});
			return cached[0].payload as NagerHoliday[];
		}
		throw err;
	}
	await db
		.insert(holidaysCache)
		.values({ id, country: country.toUpperCase(), year, payload, fetchedAt: now })
		.onConflictDoUpdate({ target: holidaysCache.id, set: { payload, fetchedAt: now } });
	calls.push({ endpoint, requestKey: id, cacheHit: false, fetchedAt: now.toISOString() });
	return payload;
}

const dayMs = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * dayMs));

/** Long weekends: three or more consecutive days off made of weekends and public holidays. */
export function longWeekends(
	holidayDates: string[],
	from: string,
	to: string,
	windowFrom: string,
	windowTo: string
): LongWeekend[] {
	const holidays = new Set(holidayDates);
	const off = (iso: string) => {
		const dow = toDate(iso).getUTCDay();
		return dow === 0 || dow === 6 || holidays.has(iso);
	};
	const out: LongWeekend[] = [];
	let cursor = from;
	while (cursor <= to) {
		if (!off(cursor)) {
			cursor = addDays(cursor, 1);
			continue;
		}
		const start = cursor;
		let end = cursor;
		while (addDays(end, 1) <= to && off(addDays(end, 1))) end = addDays(end, 1);
		const days = Math.round((toDate(end).getTime() - toDate(start).getTime()) / dayMs) + 1;
		const included: string[] = [];
		for (let d = start; d <= end; d = addDays(d, 1)) if (holidays.has(d)) included.push(d);
		if (days >= 3 && included.length > 0) {
			out.push({
				start,
				end,
				days,
				holidays: included,
				inWindow: start <= windowTo && end >= windowFrom
			});
		}
		cursor = addDays(end, 1);
	}
	return out;
}

interface ArchiveDaily {
	time: string[];
	temperature_2m_max: (number | null)[];
	temperature_2m_min: (number | null)[];
	precipitation_sum: (number | null)[];
}
interface ArchiveResponse {
	daily?: ArchiveDaily;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);

/** Climate for the window from the same dates in the previous `years` years. */
export async function climateForWindow(
	lat: number,
	lon: number,
	from: string,
	to: string,
	calls: SourceCall[],
	deps: CalendarDeps = {},
	years = 5
): Promise<ClimateWindow | null> {
	const now = (deps.now ?? (() => new Date()))();
	const id = `window:${lat.toFixed(2)},${lon.toFixed(2)}:${from}:${to}:${years}`;
	const endpoint = 'archive-api.open-meteo.com/v1/archive';
	const db = getDb();
	const cached = await db.select().from(weatherCache).where(eq(weatherCache.id, id)).limit(1);
	if (cached[0] && now.getTime() - cached[0].fetchedAt.getTime() < 90 * dayMs) {
		calls.push({
			endpoint,
			requestKey: id,
			cacheHit: true,
			fetchedAt: cached[0].fetchedAt.toISOString()
		});
		return cached[0].payload as ClimateWindow;
	}
	const startYear = toDate(from).getUTCFullYear();
	const lastComplete = now.getUTCFullYear() - 1;
	const usedYears: number[] = [];
	const tmax: number[] = [];
	const tmin: number[] = [];
	const totals: number[] = [];
	let rainDays = 0;
	let days = 0;
	let maxDay = 0;
	for (let y = lastComplete; y > lastComplete - years; y--) {
		const shift = y - startYear;
		const f = `${toDate(from).getUTCFullYear() + shift}-${from.slice(5)}`;
		const t = `${toDate(to).getUTCFullYear() + shift}-${to.slice(5)}`;
		const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${f}&end_date=${t}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
		try {
			const data = await (deps.fetchJson ?? fetchJson)<ArchiveResponse>(url);
			const d = data.daily;
			if (!d?.time?.length) continue;
			usedYears.push(y);
			let total = 0;
			d.time.forEach((_, i) => {
				const mx = d.temperature_2m_max[i];
				const mn = d.temperature_2m_min[i];
				const p = d.precipitation_sum[i];
				if (mx != null) tmax.push(mx);
				if (mn != null) tmin.push(mn);
				if (p != null) {
					total += p;
					days++;
					if (p >= 1) rainDays++;
					if (p > maxDay) maxDay = p;
				}
			});
			totals.push(total);
		} catch (err) {
			logger.warn({ err, year: y }, 'open-meteo archive year failed');
		}
	}
	if (usedYears.length === 0) {
		calls.push({ endpoint, requestKey: id, cacheHit: false, fetchedAt: now.toISOString() });
		return null;
	}
	const payload: ClimateWindow = {
		years: usedYears,
		tmaxMean: round1(mean(tmax)),
		tminMean: round1(mean(tmin)),
		precipMean: round1(mean(totals)),
		rainDayShare: days ? Math.round((rainDays / days) * 100) / 100 : null,
		precipMaxDay: round1(maxDay),
		note: `Observed values at these dates in ${usedYears.length} previous years (Open-Meteo ERA5 archive), not a forecast.`
	};
	await db
		.insert(weatherCache)
		.values({ id, lat, lon, dateFrom: from, dateTo: to, payload, fetchedAt: now })
		.onConflictDoUpdate({ target: weatherCache.id, set: { payload, fetchedAt: now } });
	calls.push({ endpoint, requestKey: id, cacheHit: false, fetchedAt: now.toISOString() });
	return payload;
}

/** Monthly normals from the last three complete years. */
export async function climateMonths(
	lat: number,
	lon: number,
	calls: SourceCall[],
	deps: CalendarDeps = {}
): Promise<ClimateMonth[]> {
	const now = (deps.now ?? (() => new Date()))();
	const id = `months:${lat.toFixed(2)},${lon.toFixed(2)}`;
	const endpoint = 'archive-api.open-meteo.com/v1/archive';
	const db = getDb();
	const cached = await db.select().from(weatherCache).where(eq(weatherCache.id, id)).limit(1);
	if (cached[0] && now.getTime() - cached[0].fetchedAt.getTime() < 90 * dayMs) {
		calls.push({
			endpoint,
			requestKey: id,
			cacheHit: true,
			fetchedAt: cached[0].fetchedAt.toISOString()
		});
		return cached[0].payload as ClimateMonth[];
	}
	const lastComplete = now.getUTCFullYear() - 1;
	const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${lastComplete - 2}-01-01&end_date=${lastComplete}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
	let months: ClimateMonth[] = [];
	try {
		const data = await (deps.fetchJson ?? fetchJson)<ArchiveResponse>(url, 25_000);
		const d = data.daily;
		if (d?.time?.length) {
			const acc = Array.from({ length: 12 }, () => ({
				tmax: [] as number[],
				tmin: [] as number[],
				precip: 0,
				rain: 0,
				days: 0,
				years: new Set<number>()
			}));
			d.time.forEach((day, i) => {
				const m = Number(day.slice(5, 7)) - 1;
				const a = acc[m];
				a.years.add(Number(day.slice(0, 4)));
				if (d.temperature_2m_max[i] != null) a.tmax.push(d.temperature_2m_max[i]!);
				if (d.temperature_2m_min[i] != null) a.tmin.push(d.temperature_2m_min[i]!);
				const p = d.precipitation_sum[i];
				if (p != null) {
					a.precip += p;
					a.days++;
					if (p >= 1) a.rain++;
				}
			});
			months = acc.map((a, i) => ({
				month: i + 1,
				tmaxMean: round1(mean(a.tmax)),
				tminMean: round1(mean(a.tmin)),
				precipMean: a.years.size ? round1(a.precip / a.years.size) : null,
				rainDays: a.years.size ? Math.round(a.rain / a.years.size) : null
			}));
		}
	} catch (err) {
		logger.warn({ err }, 'open-meteo monthly normals failed');
	}
	if (months.length) {
		await db
			.insert(weatherCache)
			.values({
				id,
				lat,
				lon,
				dateFrom: `${lastComplete - 2}-01-01`,
				dateTo: `${lastComplete}-12-31`,
				payload: months,
				fetchedAt: now
			})
			.onConflictDoUpdate({ target: weatherCache.id, set: { payload: months, fetchedAt: now } });
	}
	calls.push({ endpoint, requestKey: id, cacheHit: false, fetchedAt: now.toISOString() });
	return months;
}

export interface MarketCalendarInput {
	country: string;
	lat: number;
	lon: number;
	from: string;
	to: string;
	/** Include monthly normals (dashboard); the brief tool skips them to save a call. */
	withMonths?: boolean;
	/** Climate for the exact window from past years (default true; the dashboard's six-month window skips it). */
	withWindowClimate?: boolean;
}

/** Holidays and long weekends from 60 days before the window to 60 days after, climate for the window. */
export async function buildMarketCalendar(
	input: MarketCalendarInput,
	calls: SourceCall[],
	deps: CalendarDeps = {}
): Promise<MarketCalendar> {
	const rangeFrom = addDays(input.from, -60);
	const rangeTo = addDays(input.to, 60);
	const years = new Set<number>([
		toDate(rangeFrom).getUTCFullYear(),
		toDate(rangeTo).getUTCFullYear()
	]);
	const raw: NagerHoliday[] = [];
	for (const y of years) {
		try {
			raw.push(...(await getHolidays(input.country, y, calls, deps)));
		} catch (err) {
			logger.warn({ err, year: y, country: input.country }, 'holidays unavailable');
		}
	}
	const holidays: Holiday[] = raw
		.filter((h) => h.date >= rangeFrom && h.date <= rangeTo && (h.global ?? true))
		.sort((a, b) => a.date.localeCompare(b.date))
		.map((h) => ({
			date: h.date,
			localName: h.localName,
			name: h.name,
			inWindow: h.date >= input.from && h.date <= input.to,
			weekday: WEEKDAYS[toDate(h.date).getUTCDay()]
		}));
	const climate =
		input.withWindowClimate === false
			? null
			: await climateForWindow(input.lat, input.lon, input.from, input.to, calls, deps).catch(
					(err) => {
						logger.warn({ err }, 'climate window unavailable');
						return null;
					}
				);
	const months = input.withMonths ? await climateMonths(input.lat, input.lon, calls, deps) : [];
	return {
		country: input.country.toUpperCase(),
		from: input.from,
		to: input.to,
		holidays,
		longWeekends: longWeekends(
			holidays.map((h) => h.date),
			rangeFrom,
			rangeTo,
			input.from,
			input.to
		),
		climate,
		climateMonths: months
	};
}
