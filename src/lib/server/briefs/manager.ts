/**
 * Starts brief runs, persists their events as they happen and fans them out
 * to SSE subscribers on this instance. One brief = one main run (the
 * counterfactual run arrives in M3). Concurrency is capped per instance so
 * a burst of requests cannot exhaust the Qloo or Vertex budget.
 */
import { nanoid } from 'nanoid';
import type { BriefStatus, CreateBriefRequest, CreateBriefResponse } from '../../api/contracts.ts';
import type { AgentEvent } from '../../brief/events.ts';
import { renderBriefMarkdown } from '../../brief/markdown.ts';
import type { Brief, BriefInput } from '../../brief/schema.ts';
import { findMarket } from '../../markets.ts';
import { runBrief } from '../agent/run.ts';
import { getEnv } from '../env.ts';
import { logger } from '../log.ts';
import { getSharedQlooClient } from '../qloo/index.ts';
import { fakeRunBrief } from './fake-runner.ts';
import {
	appendEvents,
	completeBrief,
	createBriefRecord,
	createRun,
	failRun,
	finishRun,
	setBriefStatus
} from './store.ts';

export class BriefBusyError extends Error {
	constructor(
		public readonly running: number,
		public readonly limit: number
	) {
		super(`${running} briefs are already running (limit ${limit})`);
		this.name = 'BriefBusyError';
	}
}

export type HubMessage =
	{ kind: 'event'; event: AgentEvent } | { kind: 'status'; status: BriefStatus; done: boolean };

export interface ActiveRun {
	briefId: string;
	runId?: string;
	events: AgentEvent[];
	startedAt: number;
	controller: AbortController;
}

export type BriefRunner = (options: {
	input: BriefInput;
	briefId: string;
	onEvent: (event: AgentEvent) => void;
	signal: AbortSignal;
}) => Promise<{ brief: Brief; events: AgentEvent[] }>;

const active = new Map<string, ActiveRun>();
const subscribers = new Map<string, Set<(message: HubMessage) => void>>();

export function getActiveRun(briefId: string): ActiveRun | undefined {
	return active.get(briefId);
}

export function activeRunCount(): number {
	return active.size;
}

export function subscribe(briefId: string, fn: (message: HubMessage) => void): () => void {
	let set = subscribers.get(briefId);
	if (!set) {
		set = new Set();
		subscribers.set(briefId, set);
	}
	set.add(fn);
	return () => {
		set.delete(fn);
		if (set.size === 0) subscribers.delete(briefId);
	};
}

function publish(briefId: string, message: HubMessage): void {
	for (const fn of subscribers.get(briefId) ?? []) {
		try {
			fn(message);
		} catch (err) {
			logger.warn({ err, briefId }, 'subscriber failed');
		}
	}
}

function defaultRunner(): BriefRunner {
	const env = getEnv();
	if (env.AGENT_RUNNER === 'fake') return (o) => fakeRunBrief(o);
	return (o) => runBrief({ ...o, qloo: getSharedQlooClient() });
}

export interface StartOptions {
	runner?: BriefRunner;
	id?: string;
}

/**
 * Create the brief row and start its run in the background. Resolves as soon
 * as the row exists; progress flows through the hub and the database.
 */
export async function startBriefRun(
	request: CreateBriefRequest,
	options: StartOptions = {}
): Promise<CreateBriefResponse> {
	const env = getEnv();
	if (active.size >= env.MAX_CONCURRENT_RUNS) {
		throw new BriefBusyError(active.size, env.MAX_CONCURRENT_RUNS);
	}
	const { marketId, ...input } = request;
	const market = findMarket(marketId);
	const briefId = options.id ?? `brief_${nanoid(10)}`;
	const runner = options.runner ?? defaultRunner();

	await createBriefRecord({ id: briefId, input, marketId: market?.id ?? null, status: 'running' });

	const run: ActiveRun = {
		briefId,
		events: [],
		startedAt: Date.now(),
		controller: new AbortController()
	};
	active.set(briefId, run);

	// Serialize persistence so the run row exists before its events and the
	// order on disk matches the order emitted.
	let chain: Promise<void> = Promise.resolve();
	const persist = (fn: () => Promise<void>) => {
		chain = chain
			.then(fn)
			.catch((err) => logger.error({ err, briefId }, 'persisting run data failed'));
		return chain;
	};

	const onEvent = (event: AgentEvent) => {
		run.events.push(event);
		if (event.type === 'run.started') {
			run.runId = event.runId;
			persist(() => createRun({ id: event.runId, briefId, kind: event.kind, model: event.model }));
		}
		persist(() => appendEvents(event.runId, [event]));
		publish(briefId, { kind: 'event', event });
	};

	const execute = async () => {
		const { brief } = await runner({ input, briefId, onEvent, signal: run.controller.signal });
		const markdown = renderBriefMarkdown(brief);
		await chain;
		await completeBrief(briefId, brief, markdown);
		await finishRun(brief.run);
		publish(briefId, { kind: 'status', status: brief.run.status, done: true });
		logger.info({ briefId, runId: brief.run.runId, status: brief.run.status }, 'brief persisted');
	};

	void execute()
		.catch(async (err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			logger.error({ err, briefId }, 'brief run crashed');
			await chain;
			await setBriefStatus(briefId, 'failed', message).catch(() => undefined);
			if (run.runId) await failRun(run.runId, message).catch(() => undefined);
			publish(briefId, { kind: 'status', status: 'failed', done: true });
		})
		.finally(() => {
			active.delete(briefId);
		});

	return { id: briefId, status: 'running' };
}

/** Abort every run on this instance (SIGTERM); the rows are marked failed by the next start. */
export function abortAllRuns(reason: string): void {
	for (const run of active.values()) {
		run.controller.abort(new Error(reason));
	}
}
