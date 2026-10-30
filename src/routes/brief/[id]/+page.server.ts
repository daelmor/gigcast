import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBriefRecord } from '$lib/server/briefs/store';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const record = await getBriefRecord(params.id);
	if (!record) error(404, 'Brief not found');
	if (record.status === 'running' || record.status === 'queued') {
		setHeaders({ 'cache-control': 'no-store' });
	}
	return { record };
};
