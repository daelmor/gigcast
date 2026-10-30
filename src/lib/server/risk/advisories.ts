/**
 * Travel advisories: the US State Department RSS (all countries, filtered by
 * name) and the UK FCDO Atom feed per country. Cached in memory for six hours;
 * both feeds change rarely.
 */
import type { TravelAdvisory } from '../../brief/schema.ts';
import { fetchFeed, type FeedItem } from './rss.ts';
import type { SourceCall } from './calendar.ts';

const US_FEED = 'https://travel.state.gov/_res/rss/TAsTWs.xml';

/** ISO code -> names the State Department uses -> FCDO slug. */
const COUNTRIES: Record<string, { names: string[]; fcdo: string | null }> = {
	GT: { names: ['Guatemala'], fcdo: 'guatemala' },
	SV: { names: ['El Salvador'], fcdo: 'el-salvador' },
	HN: { names: ['Honduras'], fcdo: 'honduras' },
	NI: { names: ['Nicaragua'], fcdo: 'nicaragua' },
	CR: { names: ['Costa Rica'], fcdo: 'costa-rica' },
	PA: { names: ['Panama'], fcdo: 'panama' },
	DO: { names: ['Dominican Republic'], fcdo: 'dominican-republic' },
	MX: { names: ['Mexico'], fcdo: 'mexico' },
	CO: { names: ['Colombia'], fcdo: 'colombia' },
	PR: { names: ['Puerto Rico'], fcdo: null },
	US: { names: [], fcdo: null },
	ES: { names: ['Spain'], fcdo: 'spain' },
	AR: { names: ['Argentina'], fcdo: 'argentina' },
	CL: { names: ['Chile'], fcdo: 'chile' },
	PE: { names: ['Peru'], fcdo: 'peru' },
	EC: { names: ['Ecuador'], fcdo: 'ecuador' },
	BR: { names: ['Brazil'], fcdo: 'brazil' },
	UY: { names: ['Uruguay'], fcdo: 'uruguay' },
	PY: { names: ['Paraguay'], fcdo: 'paraguay' },
	BO: { names: ['Bolivia'], fcdo: 'bolivia' },
	CU: { names: ['Cuba'], fcdo: 'cuba' },
	JM: { names: ['Jamaica'], fcdo: 'jamaica' },
	CA: { names: ['Canada'], fcdo: 'canada' }
};

interface CacheEntry {
	fetchedAt: number;
	items: FeedItem[];
}
const cache = new Map<string, CacheEntry>();
const TTL = 6 * 3_600_000;

async function cachedFeed(url: string, calls: SourceCall[], endpoint: string): Promise<FeedItem[]> {
	const hit = cache.get(url);
	if (hit && Date.now() - hit.fetchedAt < TTL) {
		calls.push({
			endpoint,
			requestKey: url,
			cacheHit: true,
			fetchedAt: new Date(hit.fetchedAt).toISOString()
		});
		return hit.items;
	}
	const res = await fetchFeed(url);
	calls.push({ endpoint, requestKey: url, cacheHit: false, fetchedAt: res.fetchedAt });
	if (!res.ok) return hit?.items ?? [];
	cache.set(url, { fetchedAt: Date.now(), items: res.items });
	return res.items;
}

/** "Guatemala - Level 3: Reconsider Travel" -> 3 */
function usLevel(title: string): number | null {
	const m = title.match(/Level\s+([1-4])/i);
	return m ? Number(m[1]) : null;
}

export async function getAdvisories(
	country: string,
	calls: SourceCall[]
): Promise<TravelAdvisory[]> {
	const info = COUNTRIES[country.toUpperCase()];
	if (!info) return [];
	const out: TravelAdvisory[] = [];
	if (info.names.length) {
		const items = await cachedFeed(US_FEED, calls, 'travel.state.gov/rss/TAsTWs');
		for (const item of items) {
			const matches = info.names.some((n) => item.title.toLowerCase().startsWith(n.toLowerCase()));
			if (!matches) continue;
			out.push({
				source: 'US State Department',
				title: item.title,
				url: item.link,
				publishedAt: item.publishedAt,
				level: usLevel(item.title),
				summary: item.snippet
			});
			break;
		}
	}
	if (info.fcdo) {
		const url = `https://www.gov.uk/foreign-travel-advice/${info.fcdo}.atom`;
		const items = await cachedFeed(url, calls, 'gov.uk/foreign-travel-advice');
		const latest = items[0];
		if (latest) {
			out.push({
				source: 'UK FCDO',
				title: latest.title,
				url: latest.link.replace(/\.atom$/, ''),
				publishedAt: latest.publishedAt,
				level: null,
				summary: latest.snippet
			});
		}
	}
	return out;
}

/** Test hook. */
export function clearAdvisoryCache(): void {
	cache.clear();
}
