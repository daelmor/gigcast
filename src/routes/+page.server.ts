import type { PageServerLoad } from './$types';
import type { BriefListItem } from '$lib/api/contracts';
import { listRecentBriefs } from '$lib/server/briefs/store';

export const load: PageServerLoad = async ({ locals }) => {
	let recent: BriefListItem[] = [];
	try {
		recent = await listRecentBriefs(9);
	} catch (err) {
		// The landing must render even when the database is unreachable.
		locals.log.error({ err }, 'listing recent briefs failed');
	}
	return { recent };
};
