import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '$lib/brief/events';
import { sectionStates } from './progress';

const b = (seq: number) => ({ seq, at: '2026-10-30T14:00:00.000Z', runId: 'r' });

describe('sectionStates', () => {
	it('is all pending with no events', () => {
		expect(Object.values(sectionStates([])).every((s) => s === 'pending')).toBe(true);
	});

	it('marks sections in progress from tool starts and ready from section.ready', () => {
		const events: AgentEvent[] = [
			{
				...b(0),
				type: 'tool_call.started',
				toolCallId: '1',
				tool: 'qloo_heatmap_neighbourhoods',
				input: {}
			},
			{ ...b(1), type: 'tool_call.started', toolCallId: '2', tool: 'qloo_trending', input: {} },
			{ ...b(2), type: 'section.ready', section: 'demandAndFit' }
		];
		const s = sectionStates(events);
		expect(s.audience).toBe('in_progress');
		expect(s.demandAndFit).toBe('ready');
		expect(s.lineup).toBe('pending');
	});

	it('marks everything ready on brief.complete', () => {
		const s = sectionStates([
			{ ...b(0), type: 'brief.complete', briefId: 'x', status: 'complete' }
		]);
		expect(Object.values(s).every((v) => v === 'ready')).toBe(true);
	});
});
