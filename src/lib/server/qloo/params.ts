/**
 * Parameter whitelist for the Qloo API.
 *
 * Qloo silently ignores invalid or misplaced parameters and returns normal
 * results (verified live, see docs/qloo-findings.md section 3). The client
 * therefore refuses to send any parameter that is not on these lists for the
 * endpoint and, for /v2/insights, for the requested `filter.type`.
 */

export const ENTITY_TYPES = [
	'urn:entity:artist',
	'urn:entity:brand',
	'urn:entity:place',
	'urn:entity:destination',
	'urn:entity:movie',
	'urn:entity:book',
	'urn:entity:person',
	'urn:entity:podcast',
	'urn:entity:tv_show',
	'urn:entity:videogame'
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type InsightsType = EntityType | 'urn:heatmap' | 'urn:demographics' | 'urn:tag';

/** Values accepted by /search `types` (observed in the API's own 400 message). */
export const SEARCH_TYPES = [
	...ENTITY_TYPES,
	'urn:entity:locality',
	'urn:entity:album',
	'urn:entity:actor',
	'urn:entity:author',
	'urn:entity:director',
	'urn:demographics',
	'urn:tag'
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** Age buckets returned by urn:demographics (fine) and accepted by signal.demographics.age (both). */
export const AGE_BUCKETS_FINE = [
	'24_and_younger',
	'25_to_29',
	'30_to_34',
	'35_to_44',
	'45_to_54',
	'55_and_older'
] as const;
export const AGE_BUCKETS_COARSE = ['35_and_younger', '36_to_55', '55_and_older'] as const;
export const GENDERS = ['male', 'female'] as const;

export type QlooParamValue = string | number | boolean | undefined;
export type QlooParams = Record<string, QlooParamValue>;

const SIGNALS = [
	'signal.interests.entities',
	'signal.interests.tags',
	'signal.demographics.age',
	'signal.demographics.gender',
	'signal.demographics.audiences',
	'signal.location',
	'signal.location.query',
	'signal.location.radius',
	'bias.trends'
] as const;
const PAGING = ['take', 'page'] as const;
const LOCATION_FILTERS = [
	'filter.location',
	'filter.location.query',
	'filter.location.radius'
] as const;
const PLACE_FILTERS = [
	...LOCATION_FILTERS,
	'filter.price_level.min',
	'filter.price_level.max',
	'filter.rating.min',
	'filter.rating.max',
	'filter.hours',
	'filter.exclude.location'
] as const;
const ENTITY_COMMON = [
	'filter.type',
	...PAGING,
	...SIGNALS,
	'feature.explainability',
	'filter.popularity.min',
	'filter.popularity.max',
	'filter.tags',
	'filter.exclude.tags',
	'filter.exclude.entities',
	'filter.parents.types',
	'filter.release_year.min',
	'filter.release_year.max',
	'filter.publication_year.min',
	'filter.publication_year.max'
] as const;

const entityCommon = new Set<string>(ENTITY_COMMON);

export const INSIGHTS_ALLOWED: Readonly<Record<InsightsType, ReadonlySet<string>>> = {
	'urn:entity:artist': entityCommon,
	'urn:entity:brand': entityCommon,
	'urn:entity:person': entityCommon,
	'urn:entity:movie': entityCommon,
	'urn:entity:book': entityCommon,
	'urn:entity:podcast': entityCommon,
	'urn:entity:tv_show': entityCommon,
	'urn:entity:videogame': entityCommon,
	'urn:entity:place': new Set<string>([...ENTITY_COMMON, ...PLACE_FILTERS]),
	'urn:entity:destination': new Set<string>([...ENTITY_COMMON, ...LOCATION_FILTERS]),
	'urn:heatmap': new Set<string>([
		'filter.type',
		...LOCATION_FILTERS,
		...SIGNALS,
		'output.heatmap.boundary',
		'heatmap.dimensions'
	]),
	'urn:demographics': new Set<string>(['filter.type', ...SIGNALS]),
	'urn:tag': new Set<string>([
		'filter.type',
		...PAGING,
		...SIGNALS,
		'filter.parents.types',
		'filter.tag.types',
		'filter.popularity.min',
		'filter.popularity.max'
	])
};

export const ENDPOINT_ALLOWED: Readonly<Record<string, ReadonlySet<string>>> = {
	'/search': new Set([
		'query',
		'types',
		'filter.type',
		'filter.location',
		'filter.radius',
		'filter.tags',
		'operator.filter.tags',
		'sort_by',
		...PAGING
	]),
	'/v2/tags': new Set([
		'filter.query',
		'filter.tag.types',
		'filter.parents.types',
		'filter.popularity.min',
		'filter.popularity.max',
		...PAGING
	]),
	'/v2/trending': new Set([
		'signal.interests.entities',
		'filter.type',
		'filter.start_date',
		'filter.end_date',
		...PAGING
	]),
	// a.* and b.* signal prefixes are accepted by the predicate in isAllowed().
	'/v2/insights/compare': new Set(['filter.type', ...PAGING]),
	'/entities': new Set(['entity_ids']),
	'/v2/audiences': new Set(['filter.parents.types', 'filter.audience.types', ...PAGING]),
	'/v2/audiences/types': new Set([...PAGING])
};

export class QlooParamError extends Error {
	readonly endpoint: string;
	readonly offending: string[];
	constructor(endpoint: string, offending: string[], detail: string) {
		super(`Qloo parameters rejected for ${endpoint}: ${offending.join(', ')} (${detail})`);
		this.name = 'QlooParamError';
		this.endpoint = endpoint;
		this.offending = offending;
	}
}

function isInsightsType(value: unknown): value is InsightsType {
	return typeof value === 'string' && value in INSIGHTS_ALLOWED;
}

function isAllowed(endpoint: string, key: string, allowed: ReadonlySet<string>): boolean {
	if (allowed.has(key)) return true;
	if (endpoint === '/v2/insights/compare') {
		const m = /^(a|b)\.(.+)$/.exec(key);
		return m !== null && (SIGNALS as readonly string[]).includes(m[2]);
	}
	return false;
}

/**
 * Throw when a parameter is not valid for the endpoint (and `filter.type` on
 * insights). Undefined values are ignored so callers can pass optional fields.
 */
export function assertAllowedParams(endpoint: string, params: QlooParams): void {
	const keys = Object.keys(params).filter((k) => params[k] !== undefined);
	let allowed: ReadonlySet<string> | undefined;
	if (endpoint === '/v2/insights') {
		const type = params['filter.type'];
		if (!isInsightsType(type)) {
			throw new QlooParamError(
				endpoint,
				['filter.type'],
				`unsupported filter.type ${String(type)}`
			);
		}
		allowed = INSIGHTS_ALLOWED[type];
	} else {
		allowed = ENDPOINT_ALLOWED[endpoint];
	}
	if (!allowed) throw new QlooParamError(endpoint, keys, 'unknown endpoint');
	const offending = keys.filter((k) => !isAllowed(endpoint, k, allowed));
	if (offending.length > 0) {
		throw new QlooParamError(
			endpoint,
			offending,
			`not accepted; allowed: ${[...allowed].sort().join(', ')}`
		);
	}
}

/** Drop undefined values, stringify the rest and sort by key so equal requests get equal keys. */
export function normalizeParams(params: QlooParams): Record<string, string> {
	const out: Record<string, string> = {};
	for (const key of Object.keys(params).sort()) {
		const value = params[key];
		if (value === undefined) continue;
		out[key] = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
	}
	return out;
}

/** Stable cache key: endpoint plus the sorted, URL-encoded query string. */
export function cacheKey(endpoint: string, params: QlooParams): string {
	const search = new URLSearchParams(normalizeParams(params)).toString();
	return search ? `${endpoint}?${search}` : endpoint;
}

/** WKT point in the order Qloo expects: longitude first. */
export function pointWkt(lat: number, lon: number): string {
	return `POINT(${lon} ${lat})`;
}
