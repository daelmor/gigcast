import { json } from '@sveltejs/kit';
import type { ApiError, LocalitySearchResponse } from '$lib/api/contracts';
import { logger } from '$lib/server/log';
import {
	countryHintsFor,
	createQlooClient,
	defaultRejectHints,
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
		const { candidates } = await searchLocalities(createQlooClient(), query, {
			cityName: query,
			countryHints: countryHintsFor(country),
			rejectHints: defaultRejectHints(country)
		});
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
