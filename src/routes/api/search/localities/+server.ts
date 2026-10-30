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
import { toLocalityResults } from '$lib/server/search/map';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim();
	const country = (url.searchParams.get('country') ?? '').trim();
	if (query.length < 2) {
		return json({ query, country, results: [] } satisfies LocalitySearchResponse);
	}
	try {
		const client = getSharedQlooClient();
		const criteria = {
			cityName: query,
			countryHints: countryHintsFor(country),
			rejectHints: defaultRejectHints(country)
		};
		const { candidates } = await searchLocalities(client, query, criteria);
		// Free text often lands in the wrong country ("Panama City" is in Florida). When nothing
		// acceptable came back, retry with the "<city>, <country>" variants the resolver uses.
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
		return json({
			query,
			country,
			results: toLocalityResults(candidates)
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
