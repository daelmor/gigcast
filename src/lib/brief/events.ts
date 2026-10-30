/**
 * Agent trace events. Streamed to the browser over SSE while a brief is being
 * built and persisted with the brief afterwards. Shared by server and client.
 */
import { z } from 'zod';
import { BRIEF_SECTIONS } from './schema.ts';

const base = { seq: z.number().int().nonnegative(), at: z.string(), runId: z.string() };

export const agentEventSchema = z.discriminatedUnion('type', [
	z.object({
		...base,
		type: z.literal('run.started'),
		model: z.string(),
		kind: z.enum(['main', 'counterfactual'])
	}),
	z.object({
		...base,
		type: z.literal('tool_call.started'),
		toolCallId: z.string(),
		tool: z.string(),
		input: z.unknown()
	}),
	z.object({
		...base,
		type: z.literal('tool_call.finished'),
		toolCallId: z.string(),
		tool: z.string(),
		ok: z.boolean(),
		/** One line for the trace UI, e.g. "12 similar artists (cache hit)". */
		summary: z.string(),
		cacheHit: z.boolean().optional(),
		durationMs: z.number().int().nonnegative(),
		/** Qloo requests made by this tool call, for the "every claim has a source" rule. */
		requests: z
			.array(z.object({ endpoint: z.string(), requestKey: z.string(), cacheHit: z.boolean() }))
			.default([])
	}),
	z.object({ ...base, type: z.literal('assistant.text'), text: z.string() }),
	z.object({ ...base, type: z.literal('section.ready'), section: z.enum(BRIEF_SECTIONS) }),
	z.object({
		...base,
		type: z.literal('brief.complete'),
		briefId: z.string(),
		status: z.enum(['complete', 'partial'])
	}),
	z.object({ ...base, type: z.literal('error'), message: z.string(), fatal: z.boolean() })
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type AgentEventType = AgentEvent['type'];
export type AgentEventInput = AgentEvent extends infer E
	? E extends { seq: number; at: string; runId: string }
		? Omit<E, 'seq' | 'at' | 'runId'>
		: never
	: never;
