/**
 * Starts brief runs, persists their events as they happen and fans them out
 * to SSE subscribers on this instance. One brief = the main run plus the
 * counterfactual run (same question, no tools), executed in parallel.
 * Concurrency is capped per instance so a burst of requests cannot exhaust
 * the Qloo or Vertex budget.
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
		public readonly limit: number
	) {
		super(`${running} briefs are already running (limit ${limit})`);
		this.name = 'BriefBusyError';
	}
}

/** An event once it is persisted: `id` is the database row id, monotonic across runs of a brief. */
export interface StoredEvent {
	id: number;
	event: AgentEvent;
}

export type HubMessage =
	{ kind: 'event'; stored: StoredEvent } | { kind: 'status'; status: BriefStatus; done: boolean };

export interface ActiveRun {
	briefId: string;
	runIds: Set<string>;
	/** Persisted events so far, in id order. */
	events: StoredEvent[];
	startedAt: number;
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
	/** Signed-in account that asked for the brief, when authentication is on. */
	userId?: string | null;
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

/**
 * Create the brief row and start its runs in the background. Resolves as soon
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
	const defaults = defaultRunners();
	const runMain = options.runner ?? defaults.main;
	const runCf = options.counterfactualRunner ?? defaults.counterfactual;

	await createBriefRecord({
		id: briefId,
		input,
		marketId: market?.id ?? null,
		userId: options.userId ?? null,
		status: 'running'
	});

	const run: ActiveRun = {
		briefId,
		runIds: new Set(),
		events: [],
		startedAt: Date.now(),
		controller: new AbortController()
	};
	active.set(briefId, run);

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
			runCf({ input, briefId, onEvent, signal }).catch((err: unknown) => ({
				error: err instanceof Error ? err.message : String(err)
			}))
		]);
		const brief = attachCounterfactual(main.brief, cf);
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
				counterfactual: brief.counterfactual?.status
			},
			'brief persisted'
		);
	};

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
		});

	return { id: briefId, status: 'running' };
}

/** Abort every run on this instance (SIGTERM); the rows are marked failed by the next start. */
export function abortAllRuns(reason: string): void {
	for (const run of active.values()) {
		run.controller.abort(new Error(reason));
	}
}
