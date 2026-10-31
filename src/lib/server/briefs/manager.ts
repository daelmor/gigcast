/**
 * Starts brief runs, persists their events as they happen and fans them out
 * to SSE subscribers on this instance. One brief = the main run, plus the
 * counterfactual run (same question, no tools) when COUNTERFACTUAL_RUN=on.
 *
 * Capacity: up to MAX_CONCURRENT_RUNS briefs run at the same time per
 * instance; the next MAX_QUEUED_RUNS wait in a first-in, first-out queue and
 * start as slots free up; beyond that a request is refused with 429. Queued
 * briefs exist in the database with status `queued`, so their page and their
 * event stream work while they wait and the queue position reaches the
 * viewer through the status messages.
 */
import { nanoid } from 'nanoid';
import type { BriefStatus, CreateBriefRequest, CreateBriefResponse } from '../../api/contracts.ts';
import type { AgentEvent } from '../../brief/events.ts';
import { renderBriefMarkdown } from '../../brief/markdown.ts';
import type { Brief, BriefInput, CounterfactualPanel } from '../../brief/schema.ts';
import { findMarket } from '../../markets.ts';
import { compareCounterfactual } from '../agent/counterfactual-compare.ts';
import { runCounterfactual, type CounterfactualResult } from '../agent/counterfactual.ts';
import { runBrief } from '../agent/run.ts';
import { getEnv } from '../env.ts';
import { logger } from '../log.ts';
import { getSharedQlooClient } from '../qloo/index.ts';
import { fakeRunBrief, fakeRunCounterfactual } from './fake-runner.ts';
import {
	appendEvent,
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
		public readonly queued: number,
		public readonly limit: number,
		public readonly queueLimit: number
	) {
		super(
			`${running} briefs are running and ${queued} are waiting (limits ${limit} and ${queueLimit})`
		);
		this.name = 'BriefBusyError';
	}
}

/** An event once it is persisted: `id` is the database row id, monotonic across runs of a brief. */
export interface StoredEvent {
	id: number;
	event: AgentEvent;
}

export type HubMessage =
	| { kind: 'event'; stored: StoredEvent }
	| { kind: 'status'; status: BriefStatus; done: boolean; position?: number };

export interface ActiveRun {
	briefId: string;
	state: 'queued' | 'running';
	runIds: Set<string>;
	/** Persisted events so far, in id order. */
	events: StoredEvent[];
	createdAt: number;
	startedAt?: number;
	controller: AbortController;
}

type RunnerOptions = {
	input: BriefInput;
	briefId: string;
	onEvent: (event: AgentEvent) => void;
	signal: AbortSignal;
};
export type BriefRunner = (
	options: RunnerOptions
) => Promise<{ brief: Brief; events: AgentEvent[] }>;
export type CounterfactualRunner = (options: RunnerOptions) => Promise<CounterfactualResult>;

/** Queued and running briefs on this instance, by id. */
const active = new Map<string, ActiveRun>();
/** Briefs waiting for a slot, oldest first. */
const queue: { run: ActiveRun; start: () => Promise<void> }[] = [];
const subscribers = new Map<string, Set<(message: HubMessage) => void>>();

export function getActiveRun(briefId: string): ActiveRun | undefined {
	return active.get(briefId);
}

/** Queued plus running briefs on this instance. */
export function activeRunCount(): number {
	return active.size;
}

export function runningCount(): number {
	let n = 0;
	for (const run of active.values()) if (run.state === 'running') n++;
	return n;
}

export function queuedCount(): number {
	return queue.length;
}

/** 1 for the next brief to start; undefined when the brief is not waiting. */
export function queuePosition(briefId: string): number | undefined {
	const index = queue.findIndex((q) => q.run.briefId === briefId);
	return index === -1 ? undefined : index + 1;
}

export interface Capacity {
	running: number;
	queued: number;
	limit: number;
	queueLimit: number;
}

export function capacity(): Capacity {
	const env = getEnv();
	return {
		running: runningCount(),
		queued: queue.length,
		limit: env.MAX_CONCURRENT_RUNS,
		queueLimit: env.MAX_QUEUED_RUNS
	};
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

function defaultRunners(): { main: BriefRunner; counterfactual: CounterfactualRunner } {
	const env = getEnv();
	if (env.AGENT_RUNNER === 'fake') {
		// Slow the canned trace down when a test or a screenshot needs to see the live state.
		const stepMs = Number(process.env.FAKE_RUNNER_STEP_MS ?? 120) || 120;
		return {
			main: (o) => fakeRunBrief({ ...o, stepMs }),
			counterfactual: (o) => fakeRunCounterfactual({ ...o, stepMs })
		};
	}
	return {
		main: (o) => runBrief({ ...o, qloo: getSharedQlooClient() }),
		counterfactual: (o) => runCounterfactual(o)
	};
}

export interface StartOptions {
	runner?: BriefRunner;
	counterfactualRunner?: CounterfactualRunner;
	id?: string;
}

/** Attach the counterfactual result to the finished brief, comparing names against Qloo's results. */
export function attachCounterfactual(
	brief: Brief,
	result: CounterfactualResult | { error: string }
): Brief {
	let panel: CounterfactualPanel;
	if ('error' in result) {
		panel = { status: 'failed', model: 'unknown', error: result.error };
	} else if (!result.draft) {
		panel = { status: 'failed', model: result.run.model, run: result.run, error: result.run.error };
	} else {
		panel = {
			status: 'complete',
			model: result.run.model,
			run: result.run,
			draft: result.draft,
			...compareCounterfactual(result.draft, brief)
		};
	}
	return { ...brief, counterfactual: panel };
}

/** Start as many waiting briefs as there are free slots, then tell the rest where they stand. */
function drain(): void {
	const env = getEnv();
	while (queue.length && runningCount() < env.MAX_CONCURRENT_RUNS) {
		const next = queue.shift()!;
		// Reserve the slot before the asynchronous status update so a burst cannot overshoot.
		next.run.state = 'running';
		next.run.startedAt = Date.now();
		void next.start().catch((err: unknown) => {
			logger.error({ err, briefId: next.run.briefId }, 'starting a queued brief failed');
		});
	}
	queue.forEach((q, index) =>
		publish(q.run.briefId, { kind: 'status', status: 'queued', done: false, position: index + 1 })
	);
}

/**
 * Create the brief row and start its runs in the background, or queue them
 * when every slot is taken. Resolves as soon as the row exists; progress
 * flows through the hub and the database.
 */
export async function startBriefRun(
	request: CreateBriefRequest,
	options: StartOptions = {}
): Promise<CreateBriefResponse> {
	const env = getEnv();
	const running = runningCount();
	const slotFree = running < env.MAX_CONCURRENT_RUNS;
	if (!slotFree && queue.length >= env.MAX_QUEUED_RUNS) {
		throw new BriefBusyError(running, queue.length, env.MAX_CONCURRENT_RUNS, env.MAX_QUEUED_RUNS);
	}
	const { marketId, ...input } = request;
	const market = findMarket(marketId);
	const briefId = options.id ?? `brief_${nanoid(10)}`;
	const withCounterfactual = env.COUNTERFACTUAL_RUN === 'on';
	const defaults = options.runner && options.counterfactualRunner ? undefined : defaultRunners();
	const runMain = options.runner ?? defaults!.main;
	const runCf = options.counterfactualRunner ?? defaults!.counterfactual;

	const run: ActiveRun = {
		briefId,
		state: slotFree ? 'running' : 'queued',
		runIds: new Set(),
		events: [],
		createdAt: Date.now(),
		startedAt: slotFree ? Date.now() : undefined,
		controller: new AbortController()
	};
	// Reserve the slot (or the queue place) synchronously, before any await, so concurrent
	// requests see each other; roll back if the row cannot be created.
	active.set(briefId, run);
	try {
		await createBriefRecord({
			id: briefId,
			input,
			marketId: market?.id ?? null,
			status: run.state
		});
	} catch (err) {
		active.delete(briefId);
		throw err;
	}

	// Serialize persistence so the run row exists before its events, the order on disk matches
	// the order emitted, and subscribers see an event only once it has a database id.
	let chain: Promise<void> = Promise.resolve();
	const persist = (fn: () => Promise<void>) => {
		chain = chain
			.then(fn)
			.catch((err) => logger.error({ err, briefId }, 'persisting run data failed'));
		return chain;
	};

	const onEvent = (event: AgentEvent) => {
		if (event.type === 'run.started') {
			run.runIds.add(event.runId);
			persist(() => createRun({ id: event.runId, briefId, kind: event.kind, model: event.model }));
		}
		persist(async () => {
			const id = await appendEvent(event.runId, event);
			if (id === undefined) return;
			const stored = { id, event };
			run.events.push(stored);
			publish(briefId, { kind: 'event', stored });
		});
	};

	const signal = run.controller.signal;
	const execute = async () => {
		const [main, cf] = await Promise.all([
			runMain({ input, briefId, onEvent, signal }),
			withCounterfactual
				? runCf({ input, briefId, onEvent, signal }).catch((err: unknown) => ({
						error: err instanceof Error ? err.message : String(err)
					}))
				: undefined
		]);
		const brief = cf ? attachCounterfactual(main.brief, cf) : main.brief;
		const markdown = renderBriefMarkdown(brief);
		await chain;
		await completeBrief(briefId, brief, markdown);
		await finishRun(brief.run);
		if (brief.counterfactual?.run) await finishRun(brief.counterfactual.run);
		publish(briefId, { kind: 'status', status: brief.run.status, done: true });
		logger.info(
			{
				briefId,
				runId: brief.run.runId,
				status: brief.run.status,
				counterfactual: brief.counterfactual?.status,
				waitedMs: (run.startedAt ?? run.createdAt) - run.createdAt,
				durationMs: Date.now() - (run.startedAt ?? run.createdAt)
			},
			'brief persisted'
		);
	};

	const launch = () => {
		void execute()
			.catch(async (err: unknown) => {
				const message = err instanceof Error ? err.message : String(err);
				logger.error({ err, briefId }, 'brief run crashed');
				await chain;
				await setBriefStatus(briefId, 'failed', message).catch(() => undefined);
				for (const runId of run.runIds) await failRun(runId, message).catch(() => undefined);
				publish(briefId, { kind: 'status', status: 'failed', done: true });
			})
			.finally(() => {
				active.delete(briefId);
				drain();
			});
	};

	if (slotFree) {
		launch();
		return { id: briefId, status: 'running' };
	}

	queue.push({
		run,
		start: async () => {
			await setBriefStatus(briefId, 'running');
			publish(briefId, { kind: 'status', status: 'running', done: false });
			launch();
		}
	});
	const position = queue.length;
	logger.info({ briefId, position, running }, 'brief queued');
	return { id: briefId, status: 'queued', position };
}

/**
 * Abort every run on this instance and fail the waiting ones; the rows of the
 * aborted runs are marked failed by the next start.
 */
export function abortAllRuns(reason: string): void {
	for (const waiting of queue.splice(0)) {
		active.delete(waiting.run.briefId);
		void setBriefStatus(waiting.run.briefId, 'failed', reason).catch(() => undefined);
		publish(waiting.run.briefId, { kind: 'status', status: 'failed', done: true });
	}
	for (const run of active.values()) {
		run.controller.abort(new Error(reason));
	}
}
