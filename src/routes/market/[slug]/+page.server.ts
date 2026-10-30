import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMarketDashboard } from '$lib/server/risk/dashboard';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const dashboard = await getMarketDashboard(params.slug);
	if (!dashboard) error(404, 'Market not found');
	setHeaders({ 'cache-control': 'no-store' });
	return { dashboard };
};
