import { json } from '@sveltejs/kit';
import type { ApiError, ArtistSearchResponse } from '$lib/api/contracts';
import { logger } from '$lib/server/log';
import { getSharedQlooClient } from '$lib/server/qloo';
import { toArtistResult } from '$lib/server/search/map';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim();
	if (query.length < 2) {
		return json({ query, results: [] } satisfies ArtistSearchResponse);
	}
	try {
		const res = await getSharedQlooClient().search(query, 'urn:entity:artist', { take: 8 });
		return json({
			query,
			results: res.data.results.map(toArtistResult)
		} satisfies ArtistSearchResponse);
	} catch (err) {
		logger.error({ err: err instanceof Error ? err.message : String(err) }, 'artist search failed');
		return json({ error: 'Artist search is unavailable right now.' } satisfies ApiError, {
			status: 502
		});
	}
};
