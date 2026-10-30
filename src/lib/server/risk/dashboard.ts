/**
 * Market dashboard data for /market/:slug: the stored risk feed (no inline
 * ingestion, the job keeps it fresh), advisories, the next six months of
 * holidays and long weekends, monthly climate normals and recent briefs.
 */
import type { MarketDashboard } from '../../api/contracts.ts';
import { findMarket } from '../../markets.ts';
import { listRecentBriefsForMarket } from '../briefs/store.ts';
import { buildMarketCalendar, type SourceCall } from './calendar.ts';
import { getRiskFeed } from './feed.ts';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function getMarketDashboard(
	slug: string,
	now = new Date()
): Promise<MarketDashboard | undefined> {
	const market = findMarket(slug);
	if (!market) return undefined;
	const from = iso(now);
	const to = iso(new Date(now.getTime() + 180 * 86_400_000));
	const calls: SourceCall[] = [];
	const [feed, calendar, recentBriefs] = await Promise.all([
		getRiskFeed(
			{
				marketId: market.id,
				country: market.country,
				city: market.localityName,
				from,
				to,
				ensureFresh: false,
				limit: 200
			},
			calls,
			{ now: () => now }
		),
		buildMarketCalendar(
			{
				country: market.country,
				lat: market.lat,
				lon: market.lon,
				from,
				to,
				withMonths: true,
				withWindowClimate: false
			},
			calls,
			{ now: () => now }
		),
		listRecentBriefsForMarket(market.id, 6)
	]);
	return {
		market: {
			id: market.id,
			name: market.name,
			country: market.country,
			countryName: market.countryName,
			localityName: market.localityName,
			lat: market.lat,
			lon: market.lon,
			timezone: market.timezone,
			note: market.note,
			sampleArtists: market.sampleArtists,
			outlets: market.outlets
		},
		feed,
		calendar,
		recentBriefs,
		generatedAt: now.toISOString()
	};
}
