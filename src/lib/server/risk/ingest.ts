/**
 * News ingestion for a market: Google News RSS searches (Spanish and English)
 * plus the market's local outlets, deduplicated by canonical URL and title,
 * stored as headlines only, then classified by the small model in batches.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { KnownMarket } from '../../markets.ts';
import { getDb } from '../db/index.ts';
import { newsClassifications, newsItems } from '../db/schema.ts';
import { logger } from '../log.ts';
import type { AgentClient } from '../agent/run.ts';
import { canonicalUrl, newsId, splitGoogleTitle, titleKey } from './canonical.ts';
import { classifyNews, type ClassifyItem } from './classify.ts';
import { fetchFeed, type FeedItem, type FetchFeedOptions } from './rss.ts';

export interface IngestOptions {
	/** Adds artist-specific searches. */
	artist?: string;
	/** Adds a venue-specific search. */
	venue?: string;
	/** Date window the classifier should judge against. */
	from?: string;
	to?: string;
	/** Skip the model and only store headlines. */
	classify?: boolean;
	/** Newest items to classify per run (default 60; each model call takes 15). */
	classifyLimit?: number;
	/** Items older than this are not stored (default 45 days). */
	maxAgeDays?: number;
	/** Overall time budget in ms; feeds still pending when it runs out are skipped (default 60 s). */
	budgetMs?: number;
	anthropic?: AgentClient;
	fetch?: FetchFeedOptions;
	now?: () => Date;
}

export interface IngestSummary {
	marketId: string;
	feedsTried: number;
	feedsOk: number;
	itemsSeen: number;
	itemsNew: number;
	classified: number;
	errors: string[];
	durationMs: number;
}

interface Query {
	label: string;
	url: string;
	lang: 'es' | 'en';
	outlet: string | null;
}

const gnews = (q: string, lang: 'es' | 'en', country: string) => {
	const params = new URLSearchParams({ q });
	if (lang === 'es') {
		params.set('hl', 'es-419');
		params.set('gl', country);
		params.set('ceid', `${country}:es-419`);
	} else {
		params.set('hl', 'en-US');
		params.set('gl', 'US');
		params.set('ceid', 'US:en');
	}
	return `https://news.google.com/rss/search?${params.toString()}`;
};

/** The searches and feeds for a market; the outlet list comes from the market config. */
export function buildQueries(market: KnownMarket, options: IngestOptions = {}): Query[] {
	const es = market.localityName;
	const en = market.name;
	const c = market.country;
	const queries: Query[] = [
		{
			label: 'events',
			lang: 'es',
			outlet: null,
			url: gnews(`"${es}" (concierto OR festival OR estadio)`, 'es', c)
		},
		{
			label: 'security',
			lang: 'es',
			outlet: null,
			url: gnews(
				`"${es}" (seguridad OR violencia OR protesta OR bloqueo OR manifestación)`,
				'es',
				c
			)
		},
		{
			label: 'politics-health',
			lang: 'es',
			outlet: null,
			url: gnews(`"${es}" (elecciones OR huelga OR alerta sanitaria OR dengue)`, 'es', c)
		},
		{
			label: 'weather-transport',
			lang: 'es',
			outlet: null,
			url: gnews(
				`"${es}" (lluvias OR tormenta OR huracán OR inundación OR aeropuerto OR tránsito)`,
				'es',
				c
			)
		},
		{
			label: 'english',
			lang: 'en',
			outlet: null,
			url: gnews(
				`"${en}" ${market.countryName} (concert OR protest OR security OR election OR storm)`,
				'en',
				c
			)
		}
	];
	if (options.artist) {
		queries.push({
			label: 'artist',
			lang: 'es',
			outlet: null,
			url: gnews(`"${options.artist}" (concierto OR gira OR cancela)`, 'es', c)
		});
		queries.push({
			label: 'artist-en',
			lang: 'en',
			outlet: null,
			url: gnews(`"${options.artist}" (tour OR concert OR cancelled)`, 'en', c)
		});
	}
	if (options.venue) {
		queries.push({
			label: 'venue',
			lang: 'es',
			outlet: null,
			url: gnews(`"${options.venue}" "${es}"`, 'es', c)
		});
	}
	for (const outlet of market.outlets) {
		queries.push({
			label: `outlet:${outlet.name}`,
			lang: outlet.lang,
			outlet: outlet.name,
			url: outlet.rss
		});
	}
	return queries;
}

interface Normalized {
	id: string;
	canonical: string;
	url: string;
	title: string;
	snippet: string | null;
	source: string | null;
	publishedAt: Date | null;
	lang: 'es' | 'en';
	query: string;
}

function normalize(item: FeedItem, query: Query, cutoff: Date): Normalized | null {
	const canonical = canonicalUrl(item.link);
	if (!/^https?:\/\//.test(canonical)) return null;
	const published = item.publishedAt ? new Date(item.publishedAt) : null;
	if (published && published < cutoff) return null;
	const { title, source } = query.outlet
		? { title: item.title, source: query.outlet }
		: splitGoogleTitle(item.title);
	if (title.length < 8) return null;
	return {
		id: newsId(canonical),
		canonical,
		url: item.link,
		title: title.slice(0, 300),
		snippet: item.snippet,
		source: source ?? item.source,
		publishedAt: published,
		lang: query.lang,
		query: query.label
	};
}

/** Fetch every query with limited concurrency and a time budget. */
async function fetchAll(queries: Query[], options: IngestOptions, deadline: number) {
	const results: { query: Query; items: FeedItem[]; ok: boolean; error?: string }[] = [];
	const pending = [...queries];
	const worker = async () => {
		while (pending.length) {
			const q = pending.shift()!;
			if (Date.now() > deadline) {
				results.push({ query: q, items: [], ok: false, error: 'skipped: time budget exhausted' });
				continue;
			}
			const res = await fetchFeed(q.url, { timeoutMs: 12_000, ...options.fetch });
			results.push({
				query: q,
				items: res.items.slice(0, q.outlet ? 30 : 60),
				ok: res.ok,
				error: res.error
			});
		}
	};
	await Promise.all(Array.from({ length: 4 }, worker));
	return results;
}

export async function ingestMarket(
	market: KnownMarket,
	options: IngestOptions = {}
): Promise<IngestSummary> {
	const started = Date.now();
	const now = (options.now ?? (() => new Date()))();
	const deadline = started + (options.budgetMs ?? 60_000);
	const cutoff = new Date(now.getTime() - (options.maxAgeDays ?? 45) * 86_400_000);
	const queries = buildQueries(market, options);
	const errors: string[] = [];
	const fetched = await fetchAll(queries, options, deadline);

	const seenIds = new Set<string>();
	const seenTitles = new Set<string>();
	const rows: Normalized[] = [];
	let itemsSeen = 0;
	let feedsOk = 0;
	for (const f of fetched) {
		if (!f.ok) {
			errors.push(`${f.query.label}: ${f.error ?? 'failed'}`);
			continue;
		}
		feedsOk++;
		for (const item of f.items) {
			itemsSeen++;
			const n = normalize(item, f.query, cutoff);
			if (!n) continue;
			const tkey = titleKey(n.title);
			if (seenIds.has(n.id) || (tkey && seenTitles.has(tkey))) continue;
			seenIds.add(n.id);
			if (tkey) seenTitles.add(tkey);
			rows.push(n);
		}
	}

	const db = getDb();
	let itemsNew = 0;
	for (let i = 0; i < rows.length; i += 100) {
		const chunk = rows.slice(i, i + 100);
		const inserted = await db
			.insert(newsItems)
			.values(
				chunk.map((r) => ({
					id: r.id,
					marketId: market.id,
					url: r.url,
					canonicalUrl: r.canonical,
					title: r.title,
					snippet: r.snippet,
					source: r.source,
					lang: r.lang,
					query: r.query,
					publishedAt: r.publishedAt,
					fetchedAt: now
				}))
			)
			.onConflictDoNothing()
			.returning({ id: newsItems.id });
		itemsNew += inserted.length;
	}

	let classified = 0;
	if (options.classify !== false) {
		try {
			classified = await classifyPending(market, {
				limit: options.classifyLimit ?? 60,
				from: options.from,
				to: options.to,
				anthropic: options.anthropic,
				now,
				deadline: Math.max(deadline, Date.now() + 20_000)
			});
		} catch (err) {
			errors.push(`classification: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	const summary: IngestSummary = {
		marketId: market.id,
		feedsTried: queries.length,
		feedsOk,
		itemsSeen,
		itemsNew,
		classified,
		errors,
		durationMs: Date.now() - started
	};
	logger.info(summary, 'market ingested');
	return summary;
}

/** Classify stored items that have no classification yet, newest first, in batches of 15. */
export async function classifyPending(
	market: KnownMarket,
	options: {
		limit: number;
		from?: string;
		to?: string;
		anthropic?: AgentClient;
		now: Date;
		deadline?: number;
	}
): Promise<number> {
	const db = getDb();
	const pending = await db
		.select({
			id: newsItems.id,
			title: newsItems.title,
			snippet: newsItems.snippet,
			source: newsItems.source,
			publishedAt: newsItems.publishedAt
		})
		.from(newsItems)
		.leftJoin(newsClassifications, eq(newsClassifications.newsItemId, newsItems.id))
		.where(and(eq(newsItems.marketId, market.id), isNull(newsClassifications.newsItemId)))
		.orderBy(desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`))
		.limit(options.limit);
	let done = 0;
	for (let i = 0; i < pending.length; i += 15) {
		if (options.deadline && Date.now() > options.deadline) break;
		const batch: ClassifyItem[] = pending.slice(i, i + 15).map((p) => ({
			id: p.id,
			title: p.title,
			snippet: p.snippet,
			source: p.source,
			publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null
		}));
		const { results, model } = await classifyNews(
			batch,
			{
				marketName: market.localityName,
				country: market.countryName,
				from: options.from,
				to: options.to,
				today: options.now.toISOString().slice(0, 10)
			},
			{ anthropic: options.anthropic }
		);
		if (results.length === 0) continue;
		await db
			.insert(newsClassifications)
			.values(
				results.map((r) => ({
					newsItemId: r.id,
					category: r.relevant ? r.category : 'other',
					severity: r.relevant ? r.severity : 1,
					affectedEntities: r.affectedEntities,
					timeHorizon: r.timeHorizon,
					confidence: r.confidence,
					soWhat: r.soWhat,
					model,
					classifiedAt: options.now
				}))
			)
			.onConflictDoNothing();
		done += results.length;
	}
	return done;
}
