/** Pure helpers for the /new form: debounce, default dates, country list, payload builder. */
import type { CreateBriefRequest } from '$lib/api/contracts';
import type { PromoterInputs } from '$lib/brief/schema';

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const debounced = (...args: A) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn(...args);
		}, ms);
	};
	debounced.cancel = () => {
		if (timer) clearTimeout(timer);
		timer = undefined;
	};
	return debounced;
}

/** YYYY-MM-DD from the date's local calendar fields. */
export function toIsoDate(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
	const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	copy.setDate(copy.getDate() + days);
	return copy;
}

/** Defaults: today + 60 and today + 62. */
export function defaultDates(today: Date = new Date()): { dateFrom: string; dateTo: string } {
	return { dateFrom: toIsoDate(addDays(today, 60)), dateTo: toIsoDate(addDays(today, 62)) };
}

/** Returns an error message per field, or an empty object when the window is valid. */
export function validateDates(
	dateFrom: string,
	dateTo: string,
	today: Date = new Date()
): { dateFrom?: string; dateTo?: string } {
	const errors: { dateFrom?: string; dateTo?: string } = {};
	if (!dateFrom) errors.dateFrom = 'Pick a start date.';
	else if (dateFrom < toIsoDate(today)) errors.dateFrom = 'The start date cannot be in the past.';
	if (!dateTo) errors.dateTo = 'Pick an end date.';
	else if (dateFrom && dateTo < dateFrom)
		errors.dateTo = 'The end date must not be before the start.';
	return errors;
}

export const OTHER_COUNTRY = '__other__';

/** ISO 3166-1 alpha-2 codes with English names: the Americas, Spain and Portugal. */
export const COUNTRIES: { code: string; name: string }[] = [
	{ code: 'AR', name: 'Argentina' },
	{ code: 'BO', name: 'Bolivia' },
	{ code: 'BR', name: 'Brazil' },
	{ code: 'CA', name: 'Canada' },
	{ code: 'CL', name: 'Chile' },
	{ code: 'CO', name: 'Colombia' },
	{ code: 'CR', name: 'Costa Rica' },
	{ code: 'CU', name: 'Cuba' },
	{ code: 'DO', name: 'Dominican Republic' },
	{ code: 'EC', name: 'Ecuador' },
	{ code: 'SV', name: 'El Salvador' },
	{ code: 'GT', name: 'Guatemala' },
	{ code: 'HN', name: 'Honduras' },
	{ code: 'MX', name: 'Mexico' },
	{ code: 'NI', name: 'Nicaragua' },
	{ code: 'PA', name: 'Panama' },
	{ code: 'PY', name: 'Paraguay' },
	{ code: 'PE', name: 'Peru' },
	{ code: 'PT', name: 'Portugal' },
	{ code: 'PR', name: 'Puerto Rico' },
	{ code: 'ES', name: 'Spain' },
	{ code: 'US', name: 'United States' },
	{ code: 'UY', name: 'Uruguay' },
	{ code: 'VE', name: 'Venezuela' }
];

// Form state ---------------------------------------------------------------

export interface VenueRow {
	name: string;
	capacity: string;
}
export interface SaleRow {
	event: string;
	date: string;
	sold: string;
	capacity: string;
}

export interface FormState {
	marketId?: string;
	city: string;
	country: string;
	localityEntityId?: string;
	localityName?: string;
	artist: string;
	artistEntityId?: string;
	dateFrom: string;
	dateTo: string;
	venues: VenueRow[];
	priceMin: string;
	priceMax: string;
	priceCurrency: string;
	budgetAmount: string;
	budgetCurrency: string;
	sales: SaleRow[];
	notes: string;
}

export const MAX_VENUES = 3;
export const MAX_SALES = 3;

export function emptyForm(today: Date = new Date()): FormState {
	return {
		city: '',
		country: '',
		artist: '',
		...defaultDates(today),
		venues: [{ name: '', capacity: '' }],
		priceMin: '',
		priceMax: '',
		priceCurrency: 'USD',
		budgetAmount: '',
		budgetCurrency: 'USD',
		sales: [{ event: '', date: '', sold: '', capacity: '' }],
		notes: ''
	};
}

function num(s: string): number | undefined {
	const t = s.trim();
	if (t === '') return undefined;
	const n = Number(t);
	return Number.isFinite(n) ? n : undefined;
}

function clean<T extends object>(o: T): T {
	return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Only the promoter values the user filled in; undefined when nothing was filled. */
export function buildPromoter(f: FormState): PromoterInputs | undefined {
	const promoter: PromoterInputs = {};

	const venues = f.venues
		.filter((v) => v.name.trim() !== '')
		.slice(0, MAX_VENUES)
		.map((v) => clean({ name: v.name.trim(), capacity: num(v.capacity) }));
	if (venues.length) promoter.venues = venues;

	const min = num(f.priceMin);
	const max = num(f.priceMax);
	if (min !== undefined && max !== undefined) {
		promoter.ticketPriceRange = {
			min,
			max,
			currency: f.priceCurrency.trim().toUpperCase()
		};
	}

	const amount = num(f.budgetAmount);
	if (amount !== undefined) {
		promoter.budget = { amount, currency: f.budgetCurrency.trim().toUpperCase() };
	}

	const sales = f.sales
		.filter((s) => s.event.trim() !== '' && num(s.sold) !== undefined)
		.slice(0, MAX_SALES)
		.map((s) =>
			clean({
				event: s.event.trim(),
				date: s.date.trim() || undefined,
				sold: num(s.sold) as number,
				capacity: num(s.capacity)
			})
		);
	if (sales.length) promoter.pastSales = sales;

	const notes = f.notes.trim();
	if (notes) promoter.notes = notes;

	return Object.keys(promoter).length ? promoter : undefined;
}

/** The unvalidated request body; validate it with createBriefRequestSchema. */
export function buildPayload(f: FormState): Partial<CreateBriefRequest> {
	const promoter = buildPromoter(f);
	return clean({
		artist: f.artist.trim(),
		city: f.city.trim(),
		country: f.country.trim(),
		dateFrom: f.dateFrom,
		dateTo: f.dateTo,
		artistEntityId: f.artistEntityId || undefined,
		localityEntityId: f.localityEntityId || undefined,
		localityName: f.localityName || undefined,
		marketId: f.marketId || undefined,
		promoter
	});
}

/** Map zod issue paths to a flat field key, e.g. ['promoter','venues',0,'name'] -> 'promoter'. */
export function issueField(path: PropertyKey[]): string {
	return path[0] === 'promoter' ? 'promoter' : String(path[0] ?? '_');
}
