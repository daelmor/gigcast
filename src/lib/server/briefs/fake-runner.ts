/**
 * A stand-in for the Vertex agent used by end-to-end tests (AGENT_RUNNER=fake):
 * replays a short, plausible trace with small delays and returns the sample
 * brief re-labelled with the requested id and input. Never used in production.
 */
import { nanoid } from 'nanoid';
import type { AgentEvent, AgentEventInput } from '../../brief/events.ts';
import { sampleBrief } from '../../brief/fixtures/sample-brief.ts';
import { BRIEF_SECTIONS, type Brief, type BriefInput } from '../../brief/schema.ts';

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
