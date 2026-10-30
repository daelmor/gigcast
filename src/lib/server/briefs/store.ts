/**
 * Postgres persistence for briefs, their runs and the agent events, plus the
 * known-markets upsert. Thin functions over Drizzle; no business logic.
 */
import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm';
import type { BriefListItem, BriefRecord, BriefStatus, RunRecord } from '../../api/contracts.ts';
import { agentEventSchema, type AgentEvent } from '../../brief/events.ts';
import { briefInputSchema, briefSchema, type Brief, type BriefInput } from '../../brief/schema.ts';
import { KNOWN_MARKETS } from '../../markets.ts';
import { neutralizeProse, neutralizeProvider } from '../../brief/wording.ts';
import { getDb } from '../db/index.ts';
import { agentEvents, briefRuns, briefs, markets, type BriefRun } from '../db/schema.ts';
import { logger } from '../log.ts';

const iso = (d: Date | string | null | undefined): string | null =>
	d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString();

export async function createBriefRecord(options: {
	id: string;
	input: BriefInput;
	marketId?: string | null;
	status: BriefStatus;
}): Promise<void> {
	const { id, input, marketId, status } = options;
	await getDb()
		.insert(briefs)
		.values({
			id,
			marketId: marketId ?? null,
			artistName: input.artist,
			artistEntityId: input.artistEntityId ?? null,
			city: input.city,
			country: input.country,
			localityEntityId: input.localityEntityId ?? null,
			localityName: input.localityName ?? null,
			dateFrom: input.dateFrom,
			dateTo: input.dateTo,
			promoterInputs: input.promoter ?? null,
			input,
			status
		});
}

export async function setBriefStatus(
	id: string,
	status: BriefStatus,
	error?: string
): Promise<void> {
	await getDb()
		.update(briefs)
		.set({ status, error: error ?? null, updatedAt: new Date() })
		.where(eq(briefs.id, id));
}

export async function completeBrief(id: string, brief: Brief, markdown: string): Promise<void> {
	const loc = brief.resolution.locality;
	await getDb()
		.update(briefs)
		.set({
			status: brief.run.status,
			brief,
			markdown,
			error: brief.run.error ?? null,
			artistEntityId: brief.resolution.artist.entityId || null,
			localityEntityId: loc.entityId ?? null,
			localityName: loc.name ?? null,
			lat: loc.lat ?? null,
			lon: loc.lon ?? null,
			updatedAt: new Date()
		})
		.where(eq(briefs.id, id));
}

export async function createRun(options: {
	id: string;
	briefId: string;
	kind: 'main' | 'counterfactual';
	model: string;
}): Promise<void> {
	await getDb()
		.insert(briefRuns)
		.values({ ...options, status: 'running' })
		.onConflictDoNothing();
}

export async function finishRun(run: Brief['run']): Promise<void> {
	await getDb()
		.update(briefRuns)
		.set({
			status: run.status,
			finishedAt: new Date(run.finishedAt),
			inputTokens: run.usage.inputTokens,
			outputTokens: run.usage.outputTokens,
			cacheReadInputTokens: run.usage.cacheReadInputTokens,
			cacheCreationInputTokens: run.usage.cacheCreationInputTokens,
			qlooCalls: run.qlooCalls,
			qlooCacheHits: run.qlooCacheHits,
			toolCalls: run.toolCalls,
			error: run.error ?? null
		})
		.where(eq(briefRuns.id, run.runId));
}

export async function failRun(runId: string, error: string): Promise<void> {
	await getDb()
		.update(briefRuns)
		.set({ status: 'failed', finishedAt: new Date(), error })
		.where(eq(briefRuns.id, runId));
}

/** Insert one event and return its row id (undefined when it was already stored). */
export async function appendEvent(runId: string, event: AgentEvent): Promise<number | undefined> {
	const rows = await getDb()
		.insert(agentEvents)
		.values({ runId, seq: event.seq, type: event.type, payload: event })
		.onConflictDoNothing()
		.returning({ id: agentEvents.id });
	return rows[0]?.id;
}

export async function appendEvents(runId: string, events: AgentEvent[]): Promise<void> {
	if (!events.length) return;
	await getDb()
		.insert(agentEvents)
		.values(events.map((e) => ({ runId, seq: e.seq, type: e.type, payload: e })))
		.onConflictDoNothing();
}

export interface StoredEventRow {
	id: number;
	event: AgentEvent;
}

/**
 * Events of every run of a brief with a row id greater than `afterId`, in id
 * order. The row id is monotonic across the main and counterfactual runs, so
 * it doubles as the SSE event id.
 */
export async function getBriefEventsAfter(
	briefId: string,
	afterId: number
): Promise<StoredEventRow[]> {
	const rows = await getDb()
		.select({ id: agentEvents.id, payload: agentEvents.payload })
		.from(agentEvents)
		.innerJoin(briefRuns, eq(agentEvents.runId, briefRuns.id))
		.where(and(eq(briefRuns.briefId, briefId), gt(agentEvents.id, afterId)))
		.orderBy(asc(agentEvents.id));
	const out: StoredEventRow[] = [];
	for (const row of rows) {
		const parsed = agentEventSchema.safeParse(row.payload);
		if (parsed.success) out.push({ id: row.id, event: parsed.data });
		else logger.warn({ issues: parsed.error.issues.length }, 'skipping malformed persisted event');
	}
	return out;
}

function parseEvents(rows: { payload: unknown }[]): AgentEvent[] {
	const out: AgentEvent[] = [];
	for (const row of rows) {
		const parsed = agentEventSchema.safeParse(row.payload);
		if (parsed.success) out.push(parsed.data);
		else logger.warn({ issues: parsed.error.issues.length }, 'skipping malformed persisted event');
	}
	return out;
}

export async function getEventsAfter(runId: string, afterSeq: number): Promise<AgentEvent[]> {
	const rows = await getDb()
		.select({ payload: agentEvents.payload })
		.from(agentEvents)
		.where(and(eq(agentEvents.runId, runId), gt(agentEvents.seq, afterSeq)))
		.orderBy(asc(agentEvents.seq));
	return parseEvents(rows);
}

export interface BriefHead {
	id: string;
	status: BriefStatus;
	mainRunId: string | null;
}

/** Status and main run id only; cheap enough to poll from the SSE handler. */
export async function getBriefHead(id: string): Promise<BriefHead | undefined> {
	const db = getDb();
	const row = await db
		.select({ id: briefs.id, status: briefs.status })
		.from(briefs)
		.where(eq(briefs.id, id))
		.limit(1);
	if (!row[0]) return undefined;
	const run = await db
		.select({ id: briefRuns.id })
		.from(briefRuns)
		.where(and(eq(briefRuns.briefId, id), eq(briefRuns.kind, 'main')))
		.orderBy(asc(briefRuns.startedAt))
		.limit(1);
	return { id: row[0].id, status: row[0].status as BriefStatus, mainRunId: run[0]?.id ?? null };
}

function toRunRecord(r: BriefRun): RunRecord {
	return {
		id: r.id,
		kind: r.kind as RunRecord['kind'],
		model: r.model,
		status: r.status,
		startedAt: iso(r.startedAt) ?? new Date(0).toISOString(),
		finishedAt: iso(r.finishedAt),
		inputTokens: r.inputTokens,
		outputTokens: r.outputTokens,
		cacheReadInputTokens: r.cacheReadInputTokens,
		cacheCreationInputTokens: r.cacheCreationInputTokens,
		qlooCalls: r.qlooCalls,
		qlooCacheHits: r.qlooCacheHits,
		toolCalls: r.toolCalls,
		error: r.error
	};
}

export async function getBriefRecord(id: string): Promise<BriefRecord | undefined> {
	const db = getDb();
	const rows = await db.select().from(briefs).where(eq(briefs.id, id)).limit(1);
	const row = rows[0];
	if (!row) return undefined;
	const runs = await db
		.select()
		.from(briefRuns)
		.where(eq(briefRuns.briefId, id))
		.orderBy(asc(briefRuns.startedAt));
	const storedEvents = await getBriefEventsAfter(id, 0);
	const events = storedEvents.map((row) => row.event);
	const lastEventId = storedEvents.length ? storedEvents[storedEvents.length - 1].id : 0;

	const inputParsed = briefInputSchema.safeParse(row.input);
	const input: BriefInput = inputParsed.success
		? inputParsed.data
		: {
				artist: row.artistName,
				city: row.city ?? row.localityName ?? '',
				country: row.country ?? '',
				dateFrom: row.dateFrom ?? '1970-01-01',
				dateTo: row.dateTo ?? '1970-01-01'
			};
	let brief: Brief | null = null;
	if (row.brief) {
		const parsed = briefSchema.safeParse(row.brief);
		// Prose the model wrote (and briefs stored before the wording rule) may name the data
		// provider; the product only does so where provenance is shown.
		if (parsed.success) brief = neutralizeProse(parsed.data);
		else
			logger.error(
				{ briefId: id, issues: parsed.error.issues.slice(0, 3) },
				'stored brief fails schema'
			);
	}
	return {
		id: row.id,
		status: row.status as BriefStatus,
		createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
		updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
		marketId: row.marketId,
		input,
		brief,
		markdown: row.markdown ? neutralizeProvider(row.markdown) : row.markdown,
		runs: runs.map(toRunRecord),
		events,
		lastEventId
	};
}

export async function listRecentBriefs(limit = 12, marketId?: string): Promise<BriefListItem[]> {
	const rows = await getDb()
		.select({
			id: briefs.id,
			status: briefs.status,
			marketId: briefs.marketId,
			artistName: briefs.artistName,
			city: briefs.city,
			country: briefs.country,
			localityName: briefs.localityName,
			dateFrom: briefs.dateFrom,
			dateTo: briefs.dateTo,
			createdAt: briefs.createdAt,
			brief: briefs.brief
		})
		.from(briefs)
		.where(
			marketId
				? and(eq(briefs.isPublic, true), eq(briefs.marketId, marketId))
				: eq(briefs.isPublic, true)
		)
		.orderBy(desc(briefs.createdAt))
		.limit(limit);
	return rows.map((r) => {
		const draft = (r.brief as { draft?: { headline?: string; verdict?: string } } | null)?.draft;
		const verdict = draft?.verdict;
		return {
			id: r.id,
			status: r.status as BriefStatus,
			marketId: r.marketId,
			artistName: r.artistName,
			city: r.city ?? r.localityName ?? '',
			country: r.country ?? '',
			localityName: r.localityName,
			dateFrom: r.dateFrom,
			dateTo: r.dateTo,
			headline: draft?.headline ? neutralizeProvider(draft.headline) : null,
			verdict:
				verdict === 'promising' ||
				verdict === 'mixed' ||
				verdict === 'weak' ||
				verdict === 'insufficient_data'
					? verdict
					: null,
			createdAt: iso(r.createdAt) ?? new Date(0).toISOString()
		};
	});
}

export function listRecentBriefsForMarket(marketId: string, limit = 6): Promise<BriefListItem[]> {
	return listRecentBriefs(limit, marketId);
}

/** The newest complete brief of each featured market, for the landing's examples and demo mode. */
export async function listExampleBriefs(marketIds: string[]): Promise<BriefListItem[]> {
	const out: BriefListItem[] = [];
	for (const marketId of marketIds) {
		const rows = await getDb()
			.select({ id: briefs.id })
			.from(briefs)
			.where(
				and(eq(briefs.isPublic, true), eq(briefs.marketId, marketId), eq(briefs.status, 'complete'))
			)
			.orderBy(desc(briefs.createdAt))
			.limit(1);
		if (!rows[0]) continue;
		const items = await listRecentBriefs(50, marketId);
		const found = items.find((b) => b.id === rows[0].id);
		if (found) out.push(found);
	}
	return out;
}

/** Idempotent: inserts or refreshes the markets the app knows up front. */
export async function upsertKnownMarkets(): Promise<void> {
	const now = new Date();
	await getDb()
		.insert(markets)
		.values(
			KNOWN_MARKETS.map((m) => ({
				id: m.id,
				name: m.name,
				country: m.country,
				localityEntityId: m.localityEntityId,
				localityName: m.localityName,
				lat: m.lat,
				lon: m.lon,
				timezone: m.timezone,
				outlets: m.outlets,
				updatedAt: now
			}))
		)
		.onConflictDoUpdate({
			target: markets.id,
			set: {
				name: markets.name,
				country: markets.country,
				localityEntityId: markets.localityEntityId,
				localityName: markets.localityName,
				lat: markets.lat,
				lon: markets.lon,
				timezone: markets.timezone,
				outlets: sql`excluded.outlets`,
				updatedAt: now
			}
		});
}

/**
 * Briefs left `running` by a dead process are marked failed on start. Only briefs older than
 * `staleMinutes` qualify: during a deploy the previous replica may still be finishing its runs.
 */
export async function failOrphanedRuns(reason: string, staleMinutes = 20): Promise<number> {
	const db = getDb();
	const cutoff = new Date(Date.now() - staleMinutes * 60_000);
	const orphans = await db
		.select({ id: briefs.id })
		.from(briefs)
		.where(and(eq(briefs.status, 'running'), lt(briefs.createdAt, cutoff)));
	for (const o of orphans) {
		await db
			.update(briefs)
			.set({ status: 'failed', error: reason, updatedAt: new Date() })
			.where(eq(briefs.id, o.id));
		await db
			.update(briefRuns)
			.set({ status: 'failed', finishedAt: new Date(), error: reason })
			.where(and(eq(briefRuns.briefId, o.id), eq(briefRuns.status, 'running')));
	}
	return orphans.length;
}
