/**
 * The booking-brief agent loop on Claude via Vertex AI.
 *
 * Uses the SDK tool runner with streaming, adaptive thinking and an explicit
 * effort level. The system prompt and the tool list are frozen so the prefix
 * caches; the per-run content goes in the user message. Events are emitted
 * for every tool call so the UI can stream the trace. Budget guards: a tool
 * call cap (enforced by the registry), an iteration cap and a token cap per
 * turn. The run fails soft: when the model never reaches emit_brief, a
 * partial brief says which sections are missing and why.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { nanoid } from 'nanoid';
import type { AgentEvent, AgentEventInput } from '../../brief/events.ts';
import type { Brief, BriefDraft, BriefInput, RunSummary, Usage } from '../../brief/schema.ts';
import { getEnv } from '../env.ts';
import { logger } from '../log.ts';
import type { QlooClient } from '../qloo/index.ts';
import { assembleBrief, fallbackDraft } from './assemble.ts';
import { buildUserMessage, SYSTEM_PROMPT, TOOL_BUDGET } from './prompt.ts';
import { createAgentTools, ToolRegistry, type ToolCallRecord } from './tools.ts';

export type Effort = 'low' | 'medium' | 'high' | 'max';

/** The first-party client or the Vertex client; both expose the beta tool runner. */
export type AgentClient = {
	beta: { messages: { toolRunner: Anthropic['beta']['messages']['toolRunner'] } };
};

export interface RunBriefOptions {
	input: BriefInput;
	qloo: QlooClient;
	/** Injected for tests; defaults to AnthropicVertex from the environment. */
	anthropic?: AgentClient;
	model?: string;
	effort?: Effort;
	maxToolCalls?: number;
	maxIterations?: number;
	maxTokensPerTurn?: number;
	briefId?: string;
	onEvent?: (event: AgentEvent) => void;
	now?: () => Date;
	signal?: AbortSignal;
}

export interface RunBriefResult {
	brief: Brief;
	events: AgentEvent[];
	registry: ToolRegistry;
}

export function createVertexClient(): AgentClient {
	const env = getEnv();
	// Same runtime API as the first-party client; the Vertex type declares its own resource classes.
	// Several briefs run at once, so a 429 or an overloaded answer from Vertex is retried a little
	// longer than the SDK default (2) before the run fails.
	return new AnthropicVertex({
		projectId: env.GOOGLE_CLOUD_PROJECT,
		region: env.ANTHROPIC_VERTEX_REGION,
		maxRetries: 4
	}) as unknown as AgentClient;
}

const emptyUsage = (): Usage => ({
	inputTokens: 0,
	outputTokens: 0,
	cacheReadInputTokens: 0,
	cacheCreationInputTokens: 0
});

function addUsage(total: Usage, usage: Anthropic.Beta.Messages.BetaUsage | undefined): void {
	if (!usage) return;
	total.inputTokens += usage.input_tokens ?? 0;
	total.outputTokens += usage.output_tokens ?? 0;
	total.cacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
	total.cacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
}

/** The text of the tool_result the SDK produced for a tool use id, if it is in the conversation. */
function findToolResultText(
	messages: Anthropic.Beta.Messages.BetaMessageParam[],
	toolUseId: string
): string | undefined {
	for (const m of messages) {
		if (m.role !== 'user' || typeof m.content === 'string') continue;
		for (const block of m.content) {
			if (block.type !== 'tool_result' || block.tool_use_id !== toolUseId) continue;
			const text =
				typeof block.content === 'string'
					? block.content
					: (block.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join(' ');
			return text.replace(/\s+/g, ' ').trim().slice(0, 300) || undefined;
		}
	}
	return undefined;
}

export async function runBrief(options: RunBriefOptions): Promise<RunBriefResult> {
	const now = options.now ?? (() => new Date());
	const env = getEnv();
	const model = options.model ?? env.CLAUDE_PLANNER_MODEL;
	const effort: Effort = options.effort ?? 'high';
	const maxToolCalls = options.maxToolCalls ?? TOOL_BUDGET;
	const maxIterations = options.maxIterations ?? 40;
	const maxTokens = options.maxTokensPerTurn ?? 32_000;
	const runId = `run_${nanoid(12)}`;
	const briefId = options.briefId ?? `brief_${nanoid(10)}`;
	const startedAt = now().toISOString();
	const events: AgentEvent[] = [];
	const usage = emptyUsage();
	let seq = 0;

	const emit = (event: AgentEventInput): void => {
		const full = { ...event, seq: seq++, at: now().toISOString(), runId } as AgentEvent;
		events.push(full);
		try {
			options.onEvent?.(full);
		} catch (err) {
			logger.warn({ err }, 'onEvent handler failed');
		}
	};

	const registry = new ToolRegistry(maxToolCalls, {
		onStarted: (rec: ToolCallRecord) =>
			emit({
				type: 'tool_call.started',
				toolCallId: rec.toolCallId,
				tool: rec.tool,
				input: rec.input
			}),
		onFinished: (rec: ToolCallRecord) =>
			emit({
				type: 'tool_call.finished',
				toolCallId: rec.toolCallId,
				tool: rec.tool,
				ok: rec.ok,
				summary: rec.summary,
				cacheHit: rec.requests.length ? rec.requests.every((r) => r.cacheHit) : undefined,
				durationMs: rec.durationMs ?? 0,
				requests: rec.requests.map((r) => ({
					endpoint: r.endpoint,
					requestKey: r.requestKey,
					cacheHit: r.cacheHit
				}))
			})
	});
	const tools = createAgentTools({ client: options.qloo, registry, now });
	const anthropic = options.anthropic ?? createVertexClient();

	emit({ type: 'run.started', model, kind: 'main' });

	let stopReason: string | undefined;
	let fatalError: string | undefined;
	let truncated = false;
	let toolErrors = 0;

	const params = {
		model,
		max_tokens: maxTokens,
		thinking: { type: 'adaptive' as const },
		output_config: { effort },
		system: [
			{ type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } }
		],
		tools,
		messages: [
			{
				role: 'user' as const,
				content: buildUserMessage(options.input, { today: startedAt.slice(0, 10) })
			}
		],
		max_iterations: maxIterations,
		thread: false as const,
		stream: true as const,
		// Start each tool call as soon as its input has streamed instead of after the whole reply:
		// a turn that asks for three Qloo queries overlaps them with the model's remaining output.
		// Every tool is a read or an idempotent emit, so running one early is safe.
		runToolsEagerly: true
	};

	let runner = anthropic.beta.messages.toolRunner(params, { signal: options.signal });

	// Tool uses whose input fails the Zod schema never reach our tool function: the SDK answers
	// the model with the validation error and the trace would show nothing but a long silence.
	// Compare each turn's tool uses with the registry on the next turn and report the rejects.
	let previousToolUses: { id: string; name: string }[] = [];
	const reportRejectedToolUses = () => {
		for (const use of previousToolUses) {
			if (registry.calls.has(use.id)) continue;
			const detail = findToolResultText(runner.params.messages, use.id);
			emit({
				type: 'error',
				fatal: false,
				message: `${use.name} input was rejected before it ran${detail ? `: ${detail}` : ''}. The model is retrying.`
			});
			logger.warn({ runId, tool: use.name, detail }, 'tool input rejected by schema');
		}
		previousToolUses = [];
	};

	// Wrap the whole consumption: with eager input streaming, JSON the SDK cannot
	// parse rejects the iteration; re-issue from runner.params with a cap on
	// consecutive failures, and rethrow API errors.
	for (let attempt = 0; ; attempt++) {
		try {
			for await (const messageStream of runner) {
				let text = '';
				for await (const event of messageStream) {
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
						text += event.delta.text;
				}
				const message = await messageStream.finalMessage();
				attempt = 0;
				addUsage(usage, message.usage);
				reportRejectedToolUses();
				previousToolUses = message.content
					.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use')
					.map((b) => ({ id: b.id, name: b.name }));
				stopReason = message.stop_reason ?? undefined;
				if (text.trim()) emit({ type: 'assistant.text', text: text.trim() });
				const hasToolUse = message.content.some((b) => b.type === 'tool_use');
				if (message.stop_reason === 'max_tokens' && hasToolUse) {
					truncated = true;
					emit({
						type: 'error',
						message: `A tool call was truncated at ${maxTokens} tokens; stopping with a partial brief.`,
						fatal: false
					});
					break;
				}
				if (message.stop_reason === 'refusal') {
					const details =
						message.stop_details && 'category' in message.stop_details
							? String(message.stop_details.category)
							: 'unspecified';
					fatalError = `The model declined to continue (refusal, category ${details}).`;
					emit({ type: 'error', message: fatalError, fatal: true });
					break;
				}
				if (registry.draft && message.stop_reason === 'end_turn') break;
			}
			break;
		} catch (err) {
			if (err instanceof Anthropic.APIError || attempt >= 2) {
				fatalError = options.signal?.aborted
					? `The run was aborted: ${options.signal.reason instanceof Error ? options.signal.reason.message : String(options.signal.reason ?? 'no reason given')}`
					: err instanceof Error
						? err.message
						: String(err);
				emit({ type: 'error', message: fatalError, fatal: true });
				logger.error({ err, runId }, 'agent run failed');
				break;
			}
			emit({
				type: 'error',
				message: 'Tool input was not parseable JSON; re-issuing the turn.',
				fatal: false
			});
			runner = anthropic.beta.messages.toolRunner({ ...runner.params }, { signal: options.signal });
		}
	}

	reportRejectedToolUses();
	const finishedAt = now().toISOString();
	const totals = registry.totals();
	let draft: BriefDraft;
	let status: RunSummary['status'];
	if (registry.draft) {
		draft = registry.draft;
		const failedTools = [...registry.calls.values()].filter(
			(c) => !c.ok && c.tool !== 'emit_brief'
		).length;
		status = fatalError || truncated ? 'partial' : 'complete';
		toolErrors = failedTools;
	} else {
		const reason =
			fatalError ??
			(truncated
				? 'the final tool call was truncated by the token limit'
				: `the agent stopped (${stopReason ?? 'unknown'}) after ${registry.count} tool calls without calling emit_brief`);
		draft = fallbackDraft(reason);
		status = fatalError && registry.count === 0 ? 'failed' : 'partial';
	}

	const run: RunSummary = {
		runId,
		kind: 'main',
		model,
		status,
		startedAt,
		finishedAt,
		usage,
		toolCalls: totals.toolCalls,
		qlooCalls: totals.qlooCalls,
		qlooCacheHits: totals.qlooCacheHits,
		toolErrors,
		stopReason,
		missingSections: [],
		error: fatalError
	};

	const brief = assembleBrief({
		id: briefId,
		createdAt: finishedAt,
		input: options.input,
		draft,
		registry,
		run
	});
	emit({ type: 'brief.complete', briefId, status: status === 'complete' ? 'complete' : 'partial' });
	logger.info(
		{
			runId,
			briefId,
			status,
			toolCalls: totals.toolCalls,
			qlooCalls: totals.qlooCalls,
			qlooCacheHits: totals.qlooCacheHits,
			usage
		},
		'brief run finished'
	);
	return { brief, events, registry };
}
