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
	/** True when the candidate passed the country check. */
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
	const matches = criteria.countryHints.some((h) => text.includes(normalizeText(h)));
	return {
		entityId: result.entity_id,
		name: result.name,
		disambiguation: result.disambiguation ?? undefined,
		lat: result.location?.lat,
		lon: result.location?.lon,
		popularity: result.popularity ?? undefined,
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
export function localityQueries(city: string, country: string): string[] {
	const code = country.trim().toUpperCase();
	const out = [`${city}, ${country}`];
	const normalizedCity = normalizeText(city);
	if (code === 'PA' && /panama city|ciudad de panama|panama/.test(normalizedCity)) {
		out.unshift('Distrito Panamá');
	}
	if (code === 'MX' && /mexico city/.test(normalizedCity)) out.push('Ciudad de México');
	if (code === 'GT' && /guatemala city/.test(normalizedCity)) out.push('Ciudad de Guatemala');
	out.push(city);
	return [...new Set(out)];
}
