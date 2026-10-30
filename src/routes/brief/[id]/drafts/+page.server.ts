import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBriefRecord } from '$lib/server/briefs/store';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const record = await getBriefRecord(params.id);
	if (!record) error(404, 'Brief not found');
	if (!record.brief) setHeaders({ 'cache-control': 'no-store' });
	return { id: record.id, brief: record.brief ?? null, status: record.status };
};
