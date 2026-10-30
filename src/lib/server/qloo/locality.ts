/**
 * Locality resolution. Free text is dangerous with Qloo: "Panama City, Panama"
 * resolves to Florida in both /search and filter.location.query (M0 probe).
 * The product therefore resolves a locality through /search, checks the
 * country in the candidate's disambiguation, prefers an exact city-name match,
 * and from then on passes only the locality entity id to insights.
 */
import type { QlooClient, QlooRequestRef } from './client.ts';
import type { SearchResult } from './schemas.ts';

export interface LocalityCandidate {
	entityId: string;
	name: string;
	disambiguation?: string;
	lat?: number;
	lon?: number;
	popularity?: number;
	/** ISO 3166-1 alpha-2 read from the disambiguation's last segment, when known. */
	countryCode?: string;
	/** True when the candidate passed the country check (always true when no country was asked for). */
	acceptable: boolean;
}

export interface ResolvedLocality {
	entityId: string;
	name: string;
	disambiguation?: string;
	lat?: number;
	lon?: number;
	/** The query that produced the accepted candidate. */
	query: string;
	candidates: LocalityCandidate[];
	source: QlooRequestRef;
}

export interface LocalityCriteria {
	/** Plain city name, used to prefer an exact match ("Mexico City", "Distrito Panamá"). */
	cityName?: string;
	/** Lower-case substrings that must appear in name + disambiguation (country or region names). */
	countryHints: string[];
	/** Lower-case substrings that disqualify a candidate ("united states" for Latin American cities). */
	rejectHints?: string[];
}

/** Accent-insensitive, lower-case, alphanumeric-only normalization. */
export function normalizeText(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Country names (English and Spanish) for the markets the product targets first; falls back to the code. */
const COUNTRY_HINTS: Record<string, string[]> = {
	GT: ['guatemala'],
	SV: ['el salvador'],
	HN: ['honduras'],
	NI: ['nicaragua'],
	CR: ['costa rica'],
	PA: ['panama'],
	BZ: ['belize', 'belice'],
	DO: ['dominican', 'dominicana'],
	PR: ['puerto rico'],
	CU: ['cuba'],
	JM: ['jamaica'],
	MX: ['mexico'],
	CO: ['colombia'],
	VE: ['venezuela'],
	EC: ['ecuador'],
	PE: ['peru'],
	BO: ['bolivia'],
	CL: ['chile'],
	AR: ['argentina'],
	UY: ['uruguay'],
	PY: ['paraguay'],
	BR: ['brazil', 'brasil'],
	US: ['united states'],
	CA: ['canada'],
	ES: ['spain', 'espana'],
	GB: ['united kingdom', 'england', 'scotland', 'wales'],
	FR: ['france'],
	DE: ['germany', 'deutschland'],
	IT: ['italy', 'italia'],
	PT: ['portugal']
};

/** Country names as they appear at the end of a locality disambiguation (local and English). */
const COUNTRY_CODES_BY_NAME: Record<string, string> = {
	guatemala: 'GT',
	'el salvador': 'SV',
	honduras: 'HN',
	nicaragua: 'NI',
	'costa rica': 'CR',
	panama: 'PA',
	belize: 'BZ',
	belice: 'BZ',
	'republica dominicana': 'DO',
	'dominican republic': 'DO',
	'puerto rico': 'PR',
	cuba: 'CU',
	jamaica: 'JM',
	mexico: 'MX',
	colombia: 'CO',
	venezuela: 'VE',
	ecuador: 'EC',
	peru: 'PE',
	bolivia: 'BO',
	chile: 'CL',
	argentina: 'AR',
	uruguay: 'UY',
	paraguay: 'PY',
	brasil: 'BR',
	brazil: 'BR',
	'united states of america': 'US',
	'united states': 'US',
	'estados unidos': 'US',
	canada: 'CA',
	espana: 'ES',
	spain: 'ES',
	portugal: 'PT',
	'united kingdom': 'GB',
	france: 'FR',
	germany: 'DE',
	deutschland: 'DE',
	italy: 'IT',
	italia: 'IT'
};

/** "Tampa, Hillsborough, Florida, United States of America" -> "US"; undefined when unknown. */
export function countryCodeFromDisambiguation(disambiguation?: string): string | undefined {
	if (!disambiguation) return undefined;
	const last = disambiguation.split(',').pop();
	if (!last) return undefined;
	return COUNTRY_CODES_BY_NAME[normalizeText(last)];
}

/** Hints for a country given as an ISO 3166-1 alpha-2 code or a plain name. */
export function countryHintsFor(country: string): string[] {
	const code = country.trim().toUpperCase();
	if (code in COUNTRY_HINTS) return COUNTRY_HINTS[code];
	return [normalizeText(country)];
}

/** Default rejections: Latin American cities with US namesakes (Panama City, Santo Domingo, Managua...). */
export function defaultRejectHints(country: string): string[] {
	const code = country.trim().toUpperCase();
	return code === 'US' || code === 'UNITED STATES' ? [] : ['united states'];
}

export function candidateFromSearch(
	result: SearchResult,
	criteria: LocalityCriteria
): LocalityCandidate {
	const text = normalizeText(`${result.name} ${result.disambiguation ?? ''}`);
	const rejected = (criteria.rejectHints ?? []).some((h) => text.includes(normalizeText(h)));
	// No hints means no country was asked for: every candidate is acceptable and the
	// promoter picks by the disambiguation.
	const matches =
		criteria.countryHints.length === 0 ||
		criteria.countryHints.some((h) => text.includes(normalizeText(h)));
	return {
		entityId: result.entity_id,
		name: result.name,
		disambiguation: result.disambiguation ?? undefined,
		lat: result.location?.lat,
		lon: result.location?.lon,
		popularity: result.popularity ?? undefined,
		countryCode: countryCodeFromDisambiguation(result.disambiguation ?? undefined),
		acceptable: matches && !rejected
	};
}

/** Exact city-name match among acceptable candidates first, otherwise the first acceptable one. */
export function pickLocality(
	candidates: LocalityCandidate[],
	criteria: LocalityCriteria
): LocalityCandidate | undefined {
	const acceptable = candidates.filter((c) => c.acceptable);
	if (criteria.cityName) {
		const wanted = normalizeText(criteria.cityName);
		const exact = acceptable.find((c) => normalizeText(c.name) === wanted);
		if (exact) return exact;
	}
	return acceptable[0];
}

export async function searchLocalities(
	client: QlooClient,
	query: string,
	criteria: LocalityCriteria,
	take = 5
): Promise<{ candidates: LocalityCandidate[]; source: QlooRequestRef }> {
	const res = await client.search(query, 'urn:entity:locality', { take });
	return {
		candidates: res.data.results.map((r) => candidateFromSearch(r, criteria)),
		source: res.request
	};
}

/**
 * Try each query in order until one yields an acceptable candidate. Returns
 * undefined when none does; the caller then falls back to a WKT point.
 */
export async function resolveLocality(
	client: QlooClient,
	queries: string[],
	criteria: LocalityCriteria
): Promise<ResolvedLocality | undefined> {
	let all: LocalityCandidate[] = [];
	for (const query of queries) {
		const { candidates, source } = await searchLocalities(client, query, criteria);
		all = all.concat(candidates);
		const pick = pickLocality(candidates, criteria);
		if (pick) {
			return {
				entityId: pick.entityId,
				name: pick.name,
				disambiguation: pick.disambiguation,
				lat: pick.lat,
				lon: pick.lon,
				query,
				candidates: all,
				source
			};
		}
	}
	return undefined;
}

/** Queries to try for "city, country" input: localized spellings first when we know them. */
/** English country names for the query string; a plain name passes through unchanged. */
const COUNTRY_NAMES: Record<string, string> = {
	GT: 'Guatemala',
	SV: 'El Salvador',
	HN: 'Honduras',
	NI: 'Nicaragua',
	CR: 'Costa Rica',
	PA: 'Panama',
	BZ: 'Belize',
	DO: 'Dominican Republic',
	PR: 'Puerto Rico',
	CU: 'Cuba',
	JM: 'Jamaica',
	MX: 'Mexico',
	CO: 'Colombia',
	VE: 'Venezuela',
	EC: 'Ecuador',
	PE: 'Peru',
	BO: 'Bolivia',
	CL: 'Chile',
	AR: 'Argentina',
	UY: 'Uruguay',
	PY: 'Paraguay',
	BR: 'Brazil',
	US: 'United States',
	CA: 'Canada',
	ES: 'Spain',
	GB: 'United Kingdom',
	FR: 'France',
	DE: 'Germany',
	IT: 'Italy',
	PT: 'Portugal'
};

export function countryDisplayName(country: string): string {
	const code = country.trim().toUpperCase();
	return COUNTRY_NAMES[code] ?? country.trim();
}

export function localityQueries(city: string, country: string): string[] {
	const code = country.trim().toUpperCase();
	const out = [`${city}, ${countryDisplayName(country)}`];
	const normalizedCity = normalizeText(city);
	if (code === 'PA' && /panama city|ciudad de panama|panama/.test(normalizedCity)) {
		out.unshift('Distrito Panamá');
	}
	if (code === 'MX' && /mexico city/.test(normalizedCity)) out.push('Ciudad de México');
	if (code === 'GT' && /guatemala city/.test(normalizedCity)) out.push('Ciudad de Guatemala');
	out.push(city);
	return [...new Set(out)];
}
