/**
 * Classify news headlines for a promoter with the small model: category,
 * severity, affected entities, time horizon, confidence and a one-line
 * "so what". Structured output through one tool call per batch; effort low.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import {
	RISK_CATEGORIES,
	riskCategorySchema,
	TIME_HORIZONS,
	timeHorizonSchema,
	type Usage
} from '../../brief/schema.ts';
import { getEnv } from '../env.ts';
import { logger } from '../log.ts';
import { createVertexClient, type AgentClient } from '../agent/run.ts';

export const classificationSchema = z.object({
	id: z.string(),
	/** False when the item has nothing to do with running a live event in this market. */
	relevant: z.boolean(),
	category: riskCategorySchema,
	severity: z.number().int().min(1).max(5),
	affectedEntities: z.array(z.string().max(80)).max(6).default([]),
	timeHorizon: timeHorizonSchema,
	confidence: z.number().min(0).max(1),
	soWhat: z.string().max(240)
});
export type Classification = z.infer<typeof classificationSchema>;

export const classifyBatchSchema = z.object({ items: z.array(classificationSchema) });

export interface ClassifyItem {
	id: string;
	title: string;
	snippet: string | null;
	source: string | null;
	publishedAt: string | null;
}

export interface ClassifyContext {
	marketName: string;
	country: string;
	/** Date window of interest, when known. */
	from?: string;
	to?: string;
	today: string;
}

export const CLASSIFIER_SYSTEM_PROMPT = `You classify local news headlines for independent concert promoters. For each item decide whether it matters to someone planning a live music event in the given city in the coming months, and label it.

Categories: ${RISK_CATEGORIES.join(', ')}.
Severity: 1 negligible, 2 worth knowing, 3 could affect attendance or logistics, 4 likely to disrupt an event, 5 event-threatening.
Time horizon (${TIME_HORIZONS.join(', ')}) is relative to the date window when one is given; "ongoing" for persistent conditions.
Confidence 0 to 1 is how sure you are from the headline and snippet alone.
soWhat: one sentence, at most 25 words, in English, written for the promoter ("Expect road closures around Zona 1 on the 15th").

Rules: headlines about sports results, celebrity gossip, foreign countries or unrelated business are not relevant (relevant false, category other, severity 1). Do not invent facts beyond the headline and snippet. Return every item id you were given, once. Call classify_news exactly once.`;

export interface ClassifyOptions {
	anthropic?: AgentClient;
	model?: string;
	now?: () => Date;
	signal?: AbortSignal;
}

export async function classifyNews(
	items: ClassifyItem[],
	context: ClassifyContext,
	options: ClassifyOptions = {}
): Promise<{ results: Classification[]; usage: Usage; model: string }> {
	const env = getEnv();
	const model = options.model ?? env.CLAUDE_CLASSIFIER_MODEL;
	const anthropic = options.anthropic ?? createVertexClient();
	const usage: Usage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadInputTokens: 0,
		cacheCreationInputTokens: 0
	};
	if (items.length === 0) return { results: [], usage, model };

	let results: Classification[] | undefined;
	const tool = betaZodTool({
		name: 'classify_news',
		description: 'Deliver one classification per news item id. Call exactly once.',
		inputSchema: classifyBatchSchema,
		run: async (input) => {
			results = input.items;
			return JSON.stringify({ ok: true, received: input.items.length });
		}
	});
	const lines = items.map(
		(it) =>
			`- id ${it.id}: ${it.title}${it.source ? ` (${it.source}` : ''}${it.publishedAt ? `${it.source ? ', ' : ' ('}${it.publishedAt.slice(0, 10)})` : it.source ? ')' : ''}${it.snippet ? ` — ${it.snippet.slice(0, 220)}` : ''}`
	);
	const user = [
		`City: ${context.marketName}, ${context.country}. Today: ${context.today}.`,
		context.from && context.to
			? `Date window of interest: ${context.from} to ${context.to}.`
			: 'No specific date window; judge the next six months.',
		'',
		`Items (${items.length}):`,
		...lines
	].join('\n');

	try {
		const runner = anthropic.beta.messages.toolRunner(
			{
				model,
				max_tokens: 6_000,
				// claude-haiku-4-5 rejects adaptive thinking (verified live); the task needs none.
				system: [
					{
						type: 'text' as const,
						text: CLASSIFIER_SYSTEM_PROMPT,
						cache_control: { type: 'ephemeral' as const }
					}
				],
				tools: [tool],
				messages: [{ role: 'user' as const, content: user }],
				max_iterations: 2,
				thread: false as const,
				stream: true as const
			},
			{ signal: options.signal }
		);
		for await (const messageStream of runner) {
			const message = await messageStream.finalMessage();
			usage.inputTokens += message.usage.input_tokens ?? 0;
			usage.outputTokens += message.usage.output_tokens ?? 0;
			usage.cacheReadInputTokens += message.usage.cache_read_input_tokens ?? 0;
			usage.cacheCreationInputTokens += message.usage.cache_creation_input_tokens ?? 0;
			if (results || message.stop_reason === 'end_turn' || message.stop_reason === 'refusal') break;
		}
	} catch (err) {
		logger.error(
			{ err: err instanceof Anthropic.APIError ? err.message : err },
			'news classification failed'
		);
		throw err;
	}
	const known = new Set(items.map((i) => i.id));
	return { results: (results ?? []).filter((r) => known.has(r.id)), usage, model };
}
