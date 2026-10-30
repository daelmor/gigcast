import { describe, expect, it, vi } from 'vitest';
import { sampleBrief } from '../../brief/fixtures/sample-brief.ts';
import type { BriefInput } from '../../brief/schema.ts';
import { buildUserMessage, SYSTEM_PROMPT, TOOL_BUDGET } from './prompt.ts';

const input: BriefInput = {
	artist: 'Bad Bunny',
	city: 'Mexico City',
	country: 'MX',
	dateFrom: '2026-12-01',
	dateTo: '2026-12-03'
};

describe('SYSTEM_PROMPT', () => {
	it('names the contract words and the tool budget', () => {
		for (const word of ['emit_brief', 'grounded', 'inferred', 'no_coverage'])
			expect(SYSTEM_PROMPT).toContain(word);
		expect(SYSTEM_PROMPT).toContain(String(TOOL_BUDGET));
	});

	it('is identical across fresh imports (stable cache prefix)', async () => {
		const a = await import('./prompt.ts');
		vi.resetModules();
		const b = await import('./prompt.ts');
		expect(a.SYSTEM_PROMPT).toBe(b.SYSTEM_PROMPT);
		expect(a.SYSTEM_PROMPT).toBe(SYSTEM_PROMPT);
	});

	it('contains nothing that varies per run', () => {
		expect(SYSTEM_PROMPT).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
	});
});

describe('buildUserMessage', () => {
	it('includes the request details and says none provided without promoter inputs', () => {
		const message = buildUserMessage(input, { today: '2026-10-30' });
		expect(message).toContain('Artist: Bad Bunny');
		expect(message).toContain('City: Mexico City, MX');
		expect(message).toContain('2026-12-01');
		expect(message).toContain('2026-12-03');
		expect(message).toContain('Today: 2026-10-30');
		expect(message).toContain('none provided');
	});

	it('embeds the promoter inputs as JSON when present', () => {
		const promoter = sampleBrief.input.promoter;
		expect(promoter).toBeDefined();
		const message = buildUserMessage({ ...input, promoter }, { today: '2026-10-30' });
		expect(message).not.toContain('none provided');
		expect(message).toContain(JSON.stringify(promoter, null, 2));
	});
});
