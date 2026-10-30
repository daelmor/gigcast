/**
 * Market dashboard data for /market/:slug. Implemented with the risk layer in M4.
 */
import type { MarketDashboard } from '../../api/contracts.ts';

export async function getMarketDashboard(slug: string): Promise<MarketDashboard | undefined> {
	void slug;
	return undefined;
}
