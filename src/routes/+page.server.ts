import type { PageServerLoad } from './$types';
import type { BriefListItem } from '$lib/api/contracts';
import { FEATURED_MARKETS } from '$lib/markets';
import { listExampleBriefs, listRecentBriefs } from '$lib/server/briefs/store';

export const load: PageServerLoad = async ({ locals }) => {
	let recent: BriefListItem[] = [];
	let examples: BriefListItem[] = [];
	try {
		[recent, examples] = await Promise.all([
			listRecentBriefs(9),
			listExampleBriefs(FEATURED_MARKETS.map((m) => m.id))
		]);
	} catch (err) {
		// The landing must render even when the database is unreachable.
		locals.log.error({ err }, 'listing briefs failed');
	}
	return { recent, examples };
};
