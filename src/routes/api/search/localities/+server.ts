import { json } from '@sveltejs/kit';
import type { ApiError, LocalitySearchResponse } from '$lib/api/contracts';
import { logger } from '$lib/server/log';
import {
	countryHintsFor,
	defaultRejectHints,
	getSharedQlooClient,
	localityQueries,
	searchLocalities
} from '$lib/server/qloo';
import { dropSubLocalities, toLocalityResults } from '$lib/server/search/map';
import { KNOWN_MARKETS } from '$lib/markets';
import type { RequestHandler } from './$types';

const norm = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim();

/**
 * Known markets whose English or local name starts with the query, as candidates with their
 * verified locality id. Free text alone misses some of them: "Panama City" only finds Florida
 * because the graph calls the capital "Distrito Panamá".
 */
function knownMarketCandidates(query: string, country: string) {
	const q = norm(query);
	return KNOWN_MARKETS.filter(
		(m) =>
			(norm(m.name).startsWith(q) || norm(m.localityName).startsWith(q)) &&
			(!country || m.country === country.toUpperCase())
	).map((m) => ({
		entityId: m.localityEntityId,
		name: m.localityName,
		disambiguation: `${m.name}, ${m.countryName}`,
		lat: m.lat,
		lon: m.lon,
		countryCode: m.country,
		acceptable: true
	}));
}

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim();
	const country = (url.searchParams.get('country') ?? '').trim();
	if (query.length < 2) {
		return json({ query, country, results: [] } satisfies LocalitySearchResponse);
	}
	try {
		const client = getSharedQlooClient();
		// Without a country every candidate is acceptable and the promoter picks by the
		// disambiguation shown next to each name ("Panama City" lists Panama and Florida).
		const criteria = country
			? {
					cityName: query,
					countryHints: countryHintsFor(country),
					rejectHints: defaultRejectHints(country)
				}
			: { cityName: query, countryHints: [], rejectHints: [] };
		const { candidates } = await searchLocalities(client, query, criteria, country ? 5 : 8);
		// Free text often lands in the wrong country ("Panama City" is in Florida). When a country
		// was given and nothing acceptable came back, retry with the "<city>, <country>" variants.
		if (country && !candidates.some((c) => c.acceptable)) {
			for (const fallback of localityQueries(query, country)) {
				if (fallback.toLowerCase() === query.toLowerCase()) continue;
				const more = await searchLocalities(client, fallback, criteria);
				for (const c of more.candidates) {
					if (!candidates.some((k) => k.entityId === c.entityId)) candidates.push(c);
				}
				if (candidates.some((c) => c.acceptable)) break;
			}
		}
		const known = knownMarketCandidates(query, country);
		const rest = dropSubLocalities(candidates).filter(
			(c) => !known.some((k) => k.entityId === c.entityId)
		);
		return json({
			query,
			country,
			results: toLocalityResults([...known, ...rest])
		} satisfies LocalitySearchResponse);
	} catch (err) {
		logger.error(
			{ err: err instanceof Error ? err.message : String(err) },
			'locality search failed'
		);
		return json({ error: 'City search is unavailable right now.' } satisfies ApiError, {
			status: 502
		});
	}
};
