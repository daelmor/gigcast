import type { BriefListItem } from '$lib/api/contracts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	// TODO(server): wire listRecentBriefs
	return { recent: [] as BriefListItem[] };
};
