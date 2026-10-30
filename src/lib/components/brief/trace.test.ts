import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '$lib/brief/events';
import { groupTraceRows, traceCounters } from './trace';

const base = (seq: number, sec: number) => ({
	seq,
	at: new Date(Date.UTC(2026, 9, 30, 14, 0, sec)).toISOString(),
	runId: 'run_1'
});

const events: AgentEvent[] = [
	{ ...base(0, 0), type: 'run.started', model: 'm', kind: 'main' },
	{
		...base(1, 1),
		type: 'tool_call.started',
		toolCallId: 'a',
		tool: 'qloo_heatmap',
		input: { x: 1 }
	},
	{ ...base(2, 2), type: 'tool_call.started', toolCallId: 'b', tool: 'qloo_trending', input: {} },
	{
		...base(3, 3),
		type: 'tool_call.finished',
		toolCallId: 'a',
		tool: 'qloo_heatmap',
		ok: true,
		summary: '855 cells',
		cacheHit: false,
		durationMs: 900,
		requests: [{ endpoint: '/v2/insights', requestKey: 'k1', cacheHit: false }]
	},
	{ ...base(4, 4), type: 'assistant.text', text: 'thinking' },
	{
		...base(5, 6),
		type: 'tool_call.finished',
		toolCallId: 'b',
		tool: 'qloo_trending',
		ok: false,
		summary: 'failed',
		durationMs: 10,
		requests: [
			{ endpoint: '/v2/insights', requestKey: 'k2', cacheHit: true },
			{ endpoint: '/v2/insights', requestKey: 'k3', cacheHit: true }
		]
	},
	{ ...base(6, 7), type: 'tool_call.started', toolCallId: 'c', tool: 'qloo_compare', input: {} },
	{ ...base(7, 8), type: 'error', message: 'boom', fatal: false }
];

describe('groupTraceRows', () => {
	it('pairs started with finished by toolCallId and keeps other rows', () => {
		const rows = groupTraceRows(events);
		expect(rows.map((r) => r.kind)).toEqual(['run', 'tool', 'tool', 'text', 'tool', 'error']);
		const a = rows[1];
		expect(a.kind === 'tool' && a.pending).toBe(false);
		expect(a.kind === 'tool' && a.summary).toBe('855 cells');
		expect(a.kind === 'tool' && a.requests).toHaveLength(1);
		const b = rows[2];
		expect(b.kind === 'tool' && b.ok).toBe(false);
	});

	it('marks unfinished calls as pending', () => {
		const c = groupTraceRows(events)[4];
		expect(c.kind === 'tool' && c.pending).toBe(true);
		expect(c.kind === 'tool' && c.summary).toBeUndefined();
	});

	it('returns no rows for no events', () => {
		expect(groupTraceRows([])).toEqual([]);
	});
});

describe('traceCounters', () => {
	it('counts calls, requests, cache hits and elapsed time', () => {
		expect(traceCounters(events)).toEqual({
			toolCalls: 3,
			qlooRequests: 3,
			cacheHits: 2,
			elapsedMs: 8000
		});
	});

	it('is all zeros for no events', () => {
		expect(traceCounters([])).toEqual({
			toolCalls: 0,
			qlooRequests: 0,
			cacheHits: 0,
			elapsedMs: 0
		});
	});
});
