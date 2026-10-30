/**
 * A stand-in for the Vertex agent used by end-to-end tests (AGENT_RUNNER=fake):
 * replays a short, plausible trace with small delays and returns the sample
 * brief re-labelled with the requested id and input. Never used in production.
 */
import { nanoid } from 'nanoid';
import type { AgentEvent, AgentEventInput } from '../../brief/events.ts';
import { sampleBrief } from '../../brief/fixtures/sample-brief.ts';
import {
	BRIEF_SECTIONS,
	type Brief,
	type BriefInput,
	type CounterfactualDraft,
	type RunSummary
} from '../../brief/schema.ts';

export interface FakeRunOptions {
	input: BriefInput;
	briefId: string;
	onEvent?: (event: AgentEvent) => void;
	/** Delay between events in ms (default 120). */
	stepMs?: number;
	signal?: AbortSignal;
}

const sleep = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve) => {
		const t = setTimeout(resolve, ms);
		signal?.addEventListener('abort', () => {
			clearTimeout(t);
			resolve();
		});
	});

export async function fakeRunBrief(
	options: FakeRunOptions
): Promise<{ brief: Brief; events: AgentEvent[] }> {
	const runId = `run_${nanoid(12)}`;
	const stepMs = options.stepMs ?? 120;
	const events: AgentEvent[] = [];
	let seq = 0;
	const emit = (e: AgentEventInput) => {
		const full = { ...e, seq: seq++, at: new Date().toISOString(), runId } as AgentEvent;
		events.push(full);
		options.onEvent?.(full);
	};
	const call = async (tool: string, input: unknown, summary: string, endpoint: string) => {
		const toolCallId = `toolu_fake_${nanoid(8)}`;
		emit({ type: 'tool_call.started', toolCallId, tool, input });
		await sleep(stepMs, options.signal);
		emit({
			type: 'tool_call.finished',
			toolCallId,
			tool,
			ok: true,
			summary,
			cacheHit: true,
			durationMs: stepMs,
			requests: [{ endpoint, requestKey: `${endpoint}?fake=1`, cacheHit: true }]
		});
	};

	emit({ type: 'run.started', model: 'fake-runner', kind: 'main' });
	await call(
		'qloo_search_entity',
		{ name: options.input.artist, type: 'artist' },
		'3 candidates (cache)',
		'/search'
	);
	await call(
		'qloo_resolve_locality',
		{ city: options.input.city, country: options.input.country },
		`locality ${options.input.localityName ?? options.input.city}`,
		'/search'
	);
	await call(
		'qloo_heatmap',
		{ with_dimensions: true },
		'1757 heatmap cells (cache)',
		'/v2/insights'
	);
	await call(
		'qloo_audience_demographics',
		{},
		'demographics: top ages 25_to_29 (cache)',
		'/v2/insights'
	);
	await call('qloo_similar_artists', { take: 15 }, '15 similar artists (cache)', '/v2/insights');
	await call('qloo_brand_affinities', { take: 20 }, '20 brands (cache)', '/v2/insights');
	await call(
		'qloo_places_near',
		{ category: 'stadium' },
		'3 places (stadium) (cache)',
		'/v2/insights'
	);
	emit({ type: 'assistant.text', text: 'Composing the brief.' });
	await sleep(stepMs, options.signal);
	for (const section of BRIEF_SECTIONS) emit({ type: 'section.ready', section });
	const finishedAt = new Date().toISOString();
	const brief: Brief = {
		...sampleBrief,
		id: options.briefId,
		createdAt: finishedAt,
		input: options.input,
		run: {
			...sampleBrief.run,
			runId,
			model: 'fake-runner',
			startedAt: events[0]?.at ?? finishedAt,
			finishedAt
		}
	};
	emit({ type: 'brief.complete', briefId: options.briefId, status: 'complete' });
	return { brief, events };
}

const FAKE_COUNTERFACTUAL: CounterfactualDraft = {
	lineup: [
		{
			name: 'Gaby Moreno',
			role: 'co_headliner',
			why: 'Fellow Guatemalan with crossover appeal.',
			confidence: 'high'
		},
		{
			name: 'Alejandro Sanz',
			role: 'co_headliner',
			why: 'Same Latin pop generation and audience.',
			confidence: 'medium'
		},
		{
			name: 'Carlos Vives',
			role: 'support',
			why: 'Tropical-pop energy to open the night.',
			confidence: 'low'
		}
	],
	sponsors: [
		{
			name: 'Gallo',
			category: 'Beer',
			why: 'The national beer sponsors most large concerts in Guatemala.',
			confidence: 'high'
		},
		{
			name: 'Adidas',
			category: 'Sportswear',
			why: 'Broad lifestyle brand present in the market.',
			confidence: 'medium'
		},
		{
			name: 'Tigo',
			category: 'Telecommunications',
			why: 'Regional telecom with ticketing promotions.',
			confidence: 'medium'
		}
	],
	caveats: [
		'No audience data: these are general-knowledge guesses.',
		'Brand presence in the country was not verified.'
	]
};

export async function fakeRunCounterfactual(options: FakeRunOptions): Promise<{
	draft: CounterfactualDraft;
	run: RunSummary;
	events: AgentEvent[];
}> {
	const runId = `run_${nanoid(12)}`;
	const stepMs = options.stepMs ?? 120;
	const events: AgentEvent[] = [];
	let seq = 0;
	const emit = (e: AgentEventInput) => {
		const full = { ...e, seq: seq++, at: new Date().toISOString(), runId } as AgentEvent;
		events.push(full);
		options.onEvent?.(full);
	};
	const startedAt = new Date().toISOString();
	emit({ type: 'run.started', model: 'fake-runner', kind: 'counterfactual' });
	await sleep(stepMs * 3, options.signal);
	const toolCallId = `toolu_fake_${nanoid(8)}`;
	emit({
		type: 'tool_call.started',
		toolCallId,
		tool: 'emit_counterfactual',
		input: { lineup: 3, sponsors: 3 }
	});
	emit({
		type: 'tool_call.finished',
		toolCallId,
		tool: 'emit_counterfactual',
		ok: true,
		summary: '3 lineup and 3 sponsor picks without data',
		durationMs: 5,
		requests: []
	});
	const finishedAt = new Date().toISOString();
	return {
		draft: FAKE_COUNTERFACTUAL,
		events,
		run: {
			runId,
			kind: 'counterfactual',
			model: 'fake-runner',
			status: 'complete',
			startedAt,
			finishedAt,
			usage: {
				inputTokens: 900,
				outputTokens: 400,
				cacheReadInputTokens: 0,
				cacheCreationInputTokens: 0
			},
			toolCalls: 1,
			qlooCalls: 0,
			qlooCacheHits: 0,
			stopReason: 'end_turn',
			missingSections: []
		}
	};
}
