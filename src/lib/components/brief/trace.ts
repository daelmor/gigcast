import type { AgentEvent } from '$lib/brief/events';

export interface TraceRequest {
	endpoint: string;
	requestKey: string;
	cacheHit: boolean;
}

export interface ToolRow {
	kind: 'tool';
	toolCallId: string;
	tool: string;
	input: unknown;
	summary?: string;
	ok?: boolean;
	durationMs?: number;
	cacheHit?: boolean;
	requests: TraceRequest[];
	pending: boolean;
}

export type TraceRow =
	| ToolRow
	| { kind: 'text'; seq: number; text: string }
	| { kind: 'error'; seq: number; message: string; fatal: boolean }
	| { kind: 'run'; seq: number; model: string; runKind: 'main' | 'counterfactual' }
	| { kind: 'complete'; seq: number; briefId: string; status: 'complete' | 'partial' };

/** Pair tool_call.started with tool_call.finished; other events keep their own row. */
export function groupTraceRows(events: AgentEvent[]): TraceRow[] {
	const rows: TraceRow[] = [];
	const byCall = new Map<string, ToolRow>();
	for (const e of events) {
		switch (e.type) {
			case 'run.started':
				rows.push({ kind: 'run', seq: e.seq, model: e.model, runKind: e.kind });
				break;
			case 'tool_call.started': {
				const row: ToolRow = {
					kind: 'tool',
					toolCallId: e.toolCallId,
					tool: e.tool,
					input: e.input,
					requests: [],
					pending: true
				};
				byCall.set(e.toolCallId, row);
				rows.push(row);
				break;
			}
			case 'tool_call.finished': {
				let row = byCall.get(e.toolCallId);
				if (!row) {
					// Finished without a started event (late subscriber): still show it.
					row = {
						kind: 'tool',
						toolCallId: e.toolCallId,
						tool: e.tool,
						input: undefined,
						requests: [],
						pending: true
					};
					byCall.set(e.toolCallId, row);
					rows.push(row);
				}
				row.summary = e.summary;
				row.ok = e.ok;
				row.durationMs = e.durationMs;
				row.cacheHit = e.cacheHit;
				row.requests = e.requests;
				row.pending = false;
				break;
			}
			case 'assistant.text':
				rows.push({ kind: 'text', seq: e.seq, text: e.text });
				break;
			case 'error':
				rows.push({ kind: 'error', seq: e.seq, message: e.message, fatal: e.fatal });
				break;
			case 'brief.complete':
				rows.push({ kind: 'complete', seq: e.seq, briefId: e.briefId, status: e.status });
				break;
			case 'section.ready':
				break;
		}
	}
	return rows;
}

export interface TraceCounters {
	toolCalls: number;
	qlooRequests: number;
	cacheHits: number;
	elapsedMs: number;
}

export function traceCounters(events: AgentEvent[]): TraceCounters {
	let toolCalls = 0;
	let qlooRequests = 0;
	let cacheHits = 0;
	let min = Infinity;
	let max = -Infinity;
	for (const e of events) {
		const t = Date.parse(e.at);
		if (Number.isFinite(t)) {
			min = Math.min(min, t);
			max = Math.max(max, t);
		}
		if (e.type === 'tool_call.started') toolCalls++;
		if (e.type === 'tool_call.finished') {
			qlooRequests += e.requests.length;
			cacheHits += e.requests.filter((r) => r.cacheHit).length;
		}
	}
	return { toolCalls, qlooRequests, cacheHits, elapsedMs: max >= min ? max - min : 0 };
}
