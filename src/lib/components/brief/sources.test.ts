import { describe, expect, it } from 'vitest';
import { sampleBrief } from '$lib/brief/fixtures/sample-brief';
import { renderBriefMarkdown } from '$lib/brief/markdown';
import { buildSourceIndex } from './sources';

describe('buildSourceIndex', () => {
	it('numbers sources exactly like the Markdown renderer', () => {
		const md = renderBriefMarkdown(sampleBrief);
		const fromMarkdown = [...md.matchAll(/^- \[S(\d+)\] tool `([^`]+)`/gm)].map((m) => ({
			n: Number(m[1]),
			tool: m[2]
		}));
		const { order, indexByCallId } = buildSourceIndex(sampleBrief);
		expect(fromMarkdown.length).toBe(order.length);
		expect(order.map((r) => r.tool)).toEqual(fromMarkdown.map((m) => m.tool));
		order.forEach((r, i) => expect(indexByCallId.get(r.toolCallId)).toBe(i + 1));
	});

	it('covers every distinct artifact source once', () => {
		const { order, indexByCallId } = buildSourceIndex(sampleBrief);
		expect(new Set(order.map((r) => r.toolCallId)).size).toBe(order.length);
		expect(indexByCallId.size).toBe(order.length);
		expect(order.length).toBeGreaterThan(0);
	});

	it('numbers by first citation in document order and ignores unknown ids', () => {
		const { indexByCallId } = buildSourceIndex(sampleBrief);
		const first = sampleBrief.draft.audience.hotspots[0]?.sources[0];
		if (first) expect(indexByCallId.get(first)).toBe(1);
		expect(indexByCallId.has('not-a-call')).toBe(false);
	});
});
