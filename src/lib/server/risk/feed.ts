/**
 * The risk feed for a market and a date window: classified, relevant items of
 * the last weeks with decayed weights, travel advisories and the market score.
 * Refreshes the store when it is stale and a market is known.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { ClassifiedNews, RiskFeed } from '../../brief/schema.ts';
import { riskCategorySchema, timeHorizonSchema } from '../../brief/schema.ts';
import { findMarket } from '../../markets.ts';
import { getDb } from '../db/index.ts';
import { newsClassifications, newsItems } from '../db/schema.ts';
import { logger } from '../log.ts';
import type { AgentClient } from '../agent/run.ts';
import { getAdvisories } from './advisories.ts';
import type { SourceCall } from './calendar.ts';
import { ingestMarket } from './ingest.ts';
import { ageDays, decayWeight, riskScore } from './score.ts';

export interface RiskFeedQuery {
	marketId?: string | null;
	country: string;
	city: string;
	from: string;
	to: string;
	artist?: string;
	venue?: string;
	/** Default 60. */
	maxAgeDays?: number;
	/** Default 40. */
	limit?: number;
	/** Ingest first when the market has no items or they are older than `staleHours` (default true). */
	ensureFresh?: boolean;
	staleHours?: number;
}

export interface RiskFeedDeps {
	anthropic?: AgentClient;
	now?: () => Date;
	/** Test hook: replaces the ingestion. */
	ingest?: typeof ingestMarket;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function newestFetchedAt(marketId: string): Promise<Date | null> {
	const rows = await getDb()
		.select({ latest: sql<Date | null>`max(${newsItems.fetchedAt})` })
		.from(newsItems)
		.where(eq(newsItems.marketId, marketId));
	const v = rows[0]?.latest;
	return v ? new Date(v) : null;
}

export async function getRiskFeed(
	query: RiskFeedQuery,
	calls: SourceCall[],
	deps: RiskFeedDeps = {}
): Promise<RiskFeed> {
	const now = (deps.now ?? (() => new Date()))();
	const market = findMarket(query.marketId ?? undefined);
	const maxAgeDays = query.maxAgeDays ?? 60;
	const db = getDb();

	let ingestedAt: string | null = null;
	let storedItems = 0;
	let items: ClassifiedNews[] = [];

	if (market) {
		const latest = await newestFetchedAt(market.id);
		const stale =
			!latest || now.getTime() - latest.getTime() > (query.staleHours ?? 12) * 3_600_000;
		if (stale && query.ensureFresh !== false) {
			try {
				const summary = await (deps.ingest ?? ingestMarket)(market, {
					artist: query.artist,
					venue: query.venue,
					from: query.from,
					to: query.to,
					anthropic: deps.anthropic,
					now: () => now,
					budgetMs: 45_000
				});
				calls.push({
					endpoint: 'news:ingest',
					requestKey: `${market.id}:${summary.feedsOk}/${summary.feedsTried} feeds, ${summary.itemsNew} new, ${summary.classified} classified`,
					cacheHit: false,
					fetchedAt: now.toISOString()
				});
			} catch (err) {
				logger.warn({ err, marketId: market.id }, 'inline ingestion failed; serving stored items');
			}
		}
		const since = new Date(now.getTime() - maxAgeDays * 86_400_000);
		const rows = await db
			.select({
				id: newsItems.id,
				title: newsItems.title,
				url: newsItems.url,
				source: newsItems.source,
				snippet: newsItems.snippet,
				publishedAt: newsItems.publishedAt,
				fetchedAt: newsItems.fetchedAt,
				category: newsClassifications.category,
				severity: newsClassifications.severity,
				timeHorizon: newsClassifications.timeHorizon,
				confidence: newsClassifications.confidence,
				soWhat: newsClassifications.soWhat,
				affectedEntities: newsClassifications.affectedEntities
			})
			.from(newsItems)
			.innerJoin(newsClassifications, eq(newsClassifications.newsItemId, newsItems.id))
			.where(
				and(
					eq(newsItems.marketId, market.id),
					gte(newsClassifications.severity, 2),
					gte(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`, since)
				)
			)
			.orderBy(desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`))
			.limit(400);
		const countRows = await db
			.select({ n: sql<number>`count(*)` })
			.from(newsItems)
			.where(eq(newsItems.marketId, market.id));
		storedItems = Number(countRows[0]?.n ?? 0);
		const latestAfter = await newestFetchedAt(market.id);
		ingestedAt = latestAfter ? latestAfter.toISOString() : null;
		calls.push({
			endpoint: 'news:store',
			requestKey: `${market.id}:${rows.length} relevant of ${storedItems} stored, ${maxAgeDays} days`,
			cacheHit: true,
			fetchedAt: ingestedAt ?? now.toISOString()
		});

		const subject = [query.artist, query.venue].filter((s): s is string => Boolean(s && s.trim()));
		const subjectRe = subject.length ? new RegExp(subject.map(escapeRegExp).join('|'), 'i') : null;
		items = rows.map((r) => {
			const publishedAt = r.publishedAt ? r.publishedAt.toISOString() : null;
			const confidence = r.confidence ?? 0.5;
			const category = riskCategorySchema.safeParse(r.category).success
				? (r.category as ClassifiedNews['category'])
				: 'other';
			const horizon = timeHorizonSchema.safeParse(r.timeHorizon).success
				? (r.timeHorizon as ClassifiedNews['timeHorizon'])
				: 'unknown';
			return {
				id: r.id,
				title: r.title,
				url: r.url,
				source: r.source,
				publishedAt,
				snippet: r.snippet,
				category,
				severity: r.severity,
				timeHorizon: horizon,
				confidence,
				soWhat: r.soWhat ?? '',
				affectedEntities: Array.isArray(r.affectedEntities) ? (r.affectedEntities as string[]) : [],
				weight: decayWeight(
					r.severity,
					confidence,
					ageDays(publishedAt ?? r.fetchedAt.toISOString(), now)
				),
				mentionsSubject: subjectRe ? subjectRe.test(`${r.title} ${r.snippet ?? ''}`) : false
			};
		});
		items.sort(
			(a, b) => Number(b.mentionsSubject) - Number(a.mentionsSubject) || b.weight - a.weight
		);
	}

	const advisories = await getAdvisories(query.country, calls).catch((err) => {
		logger.warn({ err }, 'advisories unavailable');
		return [];
	});
	const score = riskScore(items, now);
	return {
		marketId: market?.id ?? null,
		country: query.country.toUpperCase(),
		city: query.city,
		from: query.from,
		to: query.to,
		items: items.slice(0, query.limit ?? 40),
		advisories,
		score,
		ingestedAt,
		storedItems
	};
}
