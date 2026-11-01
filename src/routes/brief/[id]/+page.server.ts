import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBriefRecord } from '$lib/server/briefs/store';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const record = await getBriefRecord(params.id);
	if (!record) error(404, 'Brief not found');
	if (record.status === 'running' || record.status === 'queued') {
		setHeaders({ 'cache-control': 'no-store' });
	}
	const { input } = record;
	return {
		record,
		og: {
			title: `${input.artist} · ${input.city} · ${input.dateFrom} to ${input.dateTo}`,
			description: `Booking Brief for ${input.artist} in ${input.city}, ${input.country}: audience map, lineup, sponsors, venues, pricing and risks, every claim labeled grounded, inferred or no coverage.`
		}
	};
};
