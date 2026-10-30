/**
 * The counterfactual run: the lineup and sponsor question answered by the
 * same model with every data tool removed. Cheaper (effort medium, one
 * structured answer) and run in parallel with the main brief. Its picks are
 * never "grounded"; the server later checks each name against what Qloo
 * returned in the main run so the UI can show what the data changed.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { nanoid } from 'nanoid';
import type { AgentEvent, AgentEventInput } from '../../brief/events.ts';
import {
	counterfactualDraftSchema,
	type BriefInput,
	type CounterfactualDraft,
	type RunSummary,
	type Usage
} from '../../brief/schema.ts';
import { getEnv } from '../env.ts';
import { logger } from '../log.ts';
import { createVertexClient, type AgentClient, type Effort } from './run.ts';

export const COUNTERFACTUAL_SYSTEM_PROMPT = `You are a concert booking analyst asked for a quick opinion. For this answer you have NO data tools and NO access to Qloo or any audience data: work from your own general knowledge only.

Task: for one headliner, one city and one date window, propose a compatible lineup and sponsor brands.

Rules:
1. Up to five lineup picks (artists who could open, support or co-headline), each with a role, one or two sentences of why, and your honest confidence (low, medium, high) that the pairing fits this audience in this city.
2. Up to five sponsor brands with a category, one or two sentences of why, and the same confidence.
3. Be candid about what you cannot know without data: list it in caveats (two to five short items). Do not invent affinities, percentages or audience statistics.
4. Prefer real, well-known names; if you are unsure a brand or artist operates in that country, say so in the why and lower the confidence.
5. Call emit_counterfactual exactly once with the result, then reply with one short sentence and stop.`;

export interface CounterfactualOptions {
	input: BriefInput;
	anthropic?: AgentClient;
	model?: string;
	effort?: Effort;
	maxTokens?: number;
	onEvent?: (event: AgentEvent) => void;
	now?: () => Date;
	signal?: AbortSignal;
}

export interface CounterfactualResult {
	draft?: CounterfactualDraft;
	run: RunSummary;
	events: AgentEvent[];
}

const emptyUsage = (): Usage => ({
	inputTokens: 0,
	outputTokens: 0,
	cacheReadInputTokens: 0,
	cacheCreationInputTokens: 0
});

export function buildCounterfactualUserMessage(input: BriefInput, today: string): string {
	return [
		'Give me your no-data opinion.',
		'',
		`Headliner: ${input.artist}`,
		`City: ${input.city}, ${input.country}`,
		`Date window: ${input.dateFrom} to ${input.dateTo}`,
		`Today: ${today}`
	].join('\n');
}

export async function runCounterfactual(
	options: CounterfactualOptions
): Promise<CounterfactualResult> {
	const now = options.now ?? (() => new Date());
	const env = getEnv();
	const model = options.model ?? env.CLAUDE_PLANNER_MODEL;
	const effort: Effort = options.effort ?? 'medium';
	const maxTokens = options.maxTokens ?? 8_000;
	const runId = `run_${nanoid(12)}`;
	const startedAt = now().toISOString();
	const events: AgentEvent[] = [];
	const usage = emptyUsage();
	let seq = 0;
	let draft: CounterfactualDraft | undefined;
	let fatalError: string | undefined;
	let stopReason: string | undefined;
	let toolCalls = 0;

	const emit = (event: AgentEventInput): void => {
		const full = { ...event, seq: seq++, at: now().toISOString(), runId } as AgentEvent;
		events.push(full);
		try {
			options.onEvent?.(full);
		} catch (err) {
			logger.warn({ err }, 'onEvent handler failed');
		}
	};

	const emitTool = betaZodTool({
		name: 'emit_counterfactual',
		description:
			'Deliver the no-data opinion: up to five lineup picks, up to five sponsor brands, each with a why and a confidence, plus the caveats about what you could not know. Call exactly once.',
		inputSchema: counterfactualDraftSchema,
		run: async (input, ctx) => {
			toolCalls++;
			const toolCallId = ctx?.toolUse.id ?? `toolu_${nanoid(8)}`;
			const started = Date.now();
			emit({
				type: 'tool_call.started',
				toolCallId,
				tool: 'emit_counterfactual',
				input: { lineup: input.lineup.length, sponsors: input.sponsors.length }
			});
			if (draft) {
				emit({
					type: 'tool_call.finished',
					toolCallId,
					tool: 'emit_counterfactual',
					ok: false,
					summary: 'emit_counterfactual called more than once',
					durationMs: Date.now() - started,
					requests: []
				});
				return JSON.stringify({ error: 'Already delivered. Stop.' });
			}
			draft = input;
			emit({
				type: 'tool_call.finished',
				toolCallId,
				tool: 'emit_counterfactual',
				ok: true,
				summary: `${input.lineup.length} lineup and ${input.sponsors.length} sponsor picks without data`,
				durationMs: Date.now() - started,
				requests: []
			});
			return JSON.stringify({
				ok: true,
				message: 'Delivered. Reply with one short sentence and stop.'
			});
		}
	});

	emit({ type: 'run.started', model, kind: 'counterfactual' });
	const anthropic = options.anthropic ?? createVertexClient();

	try {
		const runner = anthropic.beta.messages.toolRunner(
			{
				model,
				max_tokens: maxTokens,
				thinking: { type: 'adaptive' as const },
				output_config: { effort },
				system: [
					{
						type: 'text' as const,
						text: COUNTERFACTUAL_SYSTEM_PROMPT,
						cache_control: { type: 'ephemeral' as const }
					}
				],
				tools: [emitTool],
				messages: [
					{
						role: 'user' as const,
						content: buildCounterfactualUserMessage(options.input, startedAt.slice(0, 10))
					}
				],
				max_iterations: 3,
				thread: false as const,
				stream: true as const
			},
			{ signal: options.signal }
		);
		for await (const messageStream of runner) {
			let text = '';
			for await (const event of messageStream) {
				if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
					text += event.delta.text;
			}
			const message = await messageStream.finalMessage();
			usage.inputTokens += message.usage.input_tokens ?? 0;
			usage.outputTokens += message.usage.output_tokens ?? 0;
			usage.cacheReadInputTokens += message.usage.cache_read_input_tokens ?? 0;
			usage.cacheCreationInputTokens += message.usage.cache_creation_input_tokens ?? 0;
			stopReason = message.stop_reason ?? undefined;
			if (text.trim()) emit({ type: 'assistant.text', text: text.trim() });
			if (message.stop_reason === 'refusal') {
				fatalError = 'The model declined the counterfactual question.';
				emit({ type: 'error', message: fatalError, fatal: true });
				break;
			}
			if (draft && message.stop_reason === 'end_turn') break;
		}
	} catch (err) {
		fatalError = err instanceof Error ? err.message : String(err);
		emit({ type: 'error', message: fatalError, fatal: true });
		logger.error(
			{ err: err instanceof Anthropic.APIError ? err.message : err, runId },
			'counterfactual run failed'
		);
	}

	const finishedAt = now().toISOString();
	const run: RunSummary = {
		runId,
		kind: 'counterfactual',
		model,
		status: draft ? 'complete' : 'failed',
		startedAt,
		finishedAt,
		usage,
		toolCalls,
		qlooCalls: 0,
		qlooCacheHits: 0,
		stopReason,
		missingSections: [],
		error: draft
			? undefined
			: (fatalError ??
				`the model stopped (${stopReason ?? 'unknown'}) without calling emit_counterfactual`)
	};
	return { draft, run, events };
}
