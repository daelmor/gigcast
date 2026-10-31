/**
 * The numbers behind /admin and `pnpm stats`: briefs, visitors and page views
 * per window and per day, briefs per market, the last briefs with their run
 * cost, run durations, the most visited pages, referrers, the 404 noise and
 * the live run queue. Read-only SQL over briefs, brief_runs and request_log.
 */
import { sql } from 'drizzle-orm';
import { findMarket } from '../../markets.ts';
import { capacity, type Capacity } from '../briefs/manager.ts';
import { getDb } from '../db/index.ts';

export interface WindowStats {
	label: '24h' | '7d' | '30d';
	briefs: number;
	complete: number;
	partial: number;
	failed: number;
	/** Distinct non-bot visitor ids. */
	visitors: number;
	/** Non-bot page requests (not /api) answered below 400. */
	views: number;
	botHits: number;
	/** Brief requests refused with 429. */
	refused: number;
}

export interface DayStats {
	day: string;
	briefs: number;
	visitors: number;
	views: number;
}

export interface MarketStats {
	marketId: string | null;
	name: string;
	briefs: number;
	complete: number;
}

export interface RecentBrief {
	id: string;
	artistName: string;
	city: string;
	country: string;
	status: string;
	createdAt: string;
	/** Seconds between the request and the start of the main run (the queue wait). */
	waitedSec: number | null;
	/** Seconds the main run took, null while it runs. */
	durationSec: number | null;
	inputTokens: number;
	cacheReadInputTokens: number;
	outputTokens: number;
	toolCalls: number;
	qlooCalls: number;
	qlooCacheHits: number;
	error: string | null;
}

export interface RunStats {
	/** Finished main runs in the last 30 days. */
	count: number;
	medianSec: number | null;
	p90Sec: number | null;
	avgInputTokens: number | null;
	avgCacheReadInputTokens: number | null;
	avgOutputTokens: number | null;
	avgToolCalls: number | null;
	avgQlooCalls: number | null;
	/** Share of Qloo requests answered from the cache, 0 to 1. */
	cacheHitRate: number | null;
}

export interface PathStats {
	path: string;
	hits: number;
}

export interface HostStats {
	host: string;
	hits: number;
}

export interface AdminStats {
	generatedAt: string;
	live: Capacity;
	windows: WindowStats[];
	/** The last fourteen days, oldest first. */
	days: DayStats[];
	/** Briefs per market in the last 30 days, most first. */
	markets: MarketStats[];
	/** The last twenty briefs, newest first. */
	recentBriefs: RecentBrief[];
	runs: RunStats;
	/** Most requested pages in the last 7 days (ids collapsed), non-bot. */
	topPaths: PathStats[];
	/** Outside referrers in the last 7 days. */
	referrers: HostStats[];
	/** Most frequent 404 paths in the last 7 days. */
	notFound: PathStats[];
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const iso = (v: unknown): string =>
	v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
	const result = await getDb().execute(query);
	return result as unknown as T[];
}

async function windowStats(label: WindowStats['label'], interval: string): Promise<WindowStats> {
	const [r] = await rows<Record<string, unknown>>(sql`
		select
			(select count(*)::int from briefs where created_at > now() - ${interval}::interval) as briefs,
			(select count(*)::int from briefs where created_at > now() - ${interval}::interval and status = 'complete') as complete,
			(select count(*)::int from briefs where created_at > now() - ${interval}::interval and status = 'partial') as partial,
			(select count(*)::int from briefs where created_at > now() - ${interval}::interval and status = 'failed') as failed,
			(select count(distinct visitor)::int from request_log where at > now() - ${interval}::interval and not bot and visitor is not null) as visitors,
			(select count(*)::int from request_log where at > now() - ${interval}::interval and not bot and status < 400 and path not like '/api/%') as views,
			(select count(*)::int from request_log where at > now() - ${interval}::interval and bot) as bot_hits,
			(select count(*)::int from request_log where at > now() - ${interval}::interval and status = 429) as refused`);
	return {
		label,
		briefs: num(r?.briefs),
		complete: num(r?.complete),
		partial: num(r?.partial),
		failed: num(r?.failed),
		visitors: num(r?.visitors),
		views: num(r?.views),
		botHits: num(r?.bot_hits),
		refused: num(r?.refused)
	};
}

export async function getAdminStats(): Promise<AdminStats> {
	const [w24, w7, w30] = await Promise.all([
		windowStats('24h', '24 hours'),
		windowStats('7d', '7 days'),
		windowStats('30d', '30 days')
	]);

	const days = (
		await rows<Record<string, unknown>>(sql`
			with d as (
				select generate_series((current_date - 13)::date, current_date, '1 day')::date as day
			)
			select to_char(d.day, 'YYYY-MM-DD') as day,
				(select count(*)::int from briefs b where b.created_at::date = d.day) as briefs,
				(select count(distinct visitor)::int from request_log r
					where r.at::date = d.day and not r.bot and r.visitor is not null) as visitors,
				(select count(*)::int from request_log r
					where r.at::date = d.day and not r.bot and r.status < 400 and r.path not like '/api/%') as views
			from d order by d.day`)
	).map((r) => ({
		day: String(r.day),
		briefs: num(r.briefs),
		visitors: num(r.visitors),
		views: num(r.views)
	}));

	const markets = (
		await rows<Record<string, unknown>>(sql`
			select market_id, count(*)::int as briefs,
				count(*) filter (where status = 'complete')::int as complete
			from briefs where created_at > now() - interval '30 days'
			group by market_id order by briefs desc, market_id`)
	).map((r) => {
		const marketId = r.market_id == null ? null : String(r.market_id);
		return {
			marketId,
			name: marketId ? (findMarket(marketId)?.name ?? marketId) : 'Other cities',
			briefs: num(r.briefs),
			complete: num(r.complete)
		};
	});

	const recentBriefs = (
		await rows<Record<string, unknown>>(sql`
			select b.id, b.artist_name, b.city, b.country, b.status, b.created_at, b.error,
				extract(epoch from (r.started_at - b.created_at)) as waited_sec,
				extract(epoch from (r.finished_at - r.started_at)) as duration_sec,
				r.input_tokens, r.cache_read_input_tokens, r.output_tokens, r.tool_calls, r.qloo_calls, r.qloo_cache_hits
			from briefs b
			left join lateral (
				select * from brief_runs r where r.brief_id = b.id and r.kind = 'main'
				order by r.started_at limit 1
			) r on true
			order by b.created_at desc limit 20`)
	).map((r) => ({
		id: String(r.id),
		artistName: String(r.artist_name),
		city: r.city == null ? '' : String(r.city),
		country: r.country == null ? '' : String(r.country),
		status: String(r.status),
		createdAt: iso(r.created_at),
		waitedSec: r.waited_sec == null ? null : Math.max(0, Math.round(Number(r.waited_sec))),
		durationSec: r.duration_sec == null ? null : Math.round(Number(r.duration_sec)),
		inputTokens: num(r.input_tokens),
		cacheReadInputTokens: num(r.cache_read_input_tokens),
		outputTokens: num(r.output_tokens),
		toolCalls: num(r.tool_calls),
		qlooCalls: num(r.qloo_calls),
		qlooCacheHits: num(r.qloo_cache_hits),
		error: r.error == null ? null : String(r.error)
	}));

	const [run] = await rows<Record<string, unknown>>(sql`
		select count(*)::int as count,
			percentile_cont(0.5) within group (order by extract(epoch from (finished_at - started_at))) as median_sec,
			percentile_cont(0.9) within group (order by extract(epoch from (finished_at - started_at))) as p90_sec,
			avg(input_tokens) as avg_input, avg(cache_read_input_tokens) as avg_cache_read,
			avg(output_tokens) as avg_output, avg(tool_calls) as avg_tool_calls, avg(qloo_calls) as avg_qloo_calls,
			case when sum(qloo_calls + qloo_cache_hits) > 0
				then sum(qloo_cache_hits)::float8 / sum(qloo_calls + qloo_cache_hits) end as cache_hit_rate
		from brief_runs
		where kind = 'main' and finished_at is not null and started_at > now() - interval '30 days'`);
	const runs: RunStats = {
		count: num(run?.count),
		medianSec: numOrNull(run?.median_sec),
		p90Sec: numOrNull(run?.p90_sec),
		avgInputTokens: numOrNull(run?.avg_input),
		avgCacheReadInputTokens: numOrNull(run?.avg_cache_read),
		avgOutputTokens: numOrNull(run?.avg_output),
		avgToolCalls: numOrNull(run?.avg_tool_calls),
		avgQlooCalls: numOrNull(run?.avg_qloo_calls),
		cacheHitRate: numOrNull(run?.cache_hit_rate)
	};

	const topPaths = (
		await rows<Record<string, unknown>>(sql`
			select regexp_replace(path, 'brief_[A-Za-z0-9_-]+', ':id') as path, count(*)::int as hits
			from request_log
			where at > now() - interval '7 days' and not bot and status < 400 and path not like '/api/%'
			group by 1 order by hits desc limit 10`)
	).map((r) => ({ path: String(r.path), hits: num(r.hits) }));

	const referrers = (
		await rows<Record<string, unknown>>(sql`
			select referrer_host as host, count(*)::int as hits
			from request_log
			where at > now() - interval '7 days' and referrer_host is not null and not bot
			group by 1 order by hits desc limit 10`)
	).map((r) => ({ host: String(r.host), hits: num(r.hits) }));

	const notFound = (
		await rows<Record<string, unknown>>(sql`
			select path, count(*)::int as hits
			from request_log
			where at > now() - interval '7 days' and status = 404
			group by 1 order by hits desc limit 10`)
	).map((r) => ({ path: String(r.path), hits: num(r.hits) }));

	return {
		generatedAt: new Date().toISOString(),
		live: capacity(),
		windows: [w24, w7, w30],
		days,
		markets,
		recentBriefs,
		runs,
		topPaths,
		referrers,
		notFound
	};
}
