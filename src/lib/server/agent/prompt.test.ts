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

	it('says what the data does not show and bans the demand, price, fee and commitment claims', () => {
		expect(SYSTEM_PROMPT).toContain('# What the data does and does not show');
		expect(SYSTEM_PROMPT).toContain(
			'does not estimate ticket buyers, attendance, artist fees, availability, sponsor budgets or sponsorship interest'
		);
		for (const phrase of [
			'"the audience lives here"',
			'"deep demand"',
			'"accepts premium prices"',
			'"cost-effective opener"',
			'"will sponsor"'
		])
			expect(SYSTEM_PROMPT).toContain(phrase);
		expect(SYSTEM_PROMPT).toContain('"no coverage" never means "low demand"');
	});

	it('frames pricing as planning scenarios and asks for the missing inputs', () => {
		expect(SYSTEM_PROMPT).toContain('planning scenarios for the promoter to validate');
		expect(SYSTEM_PROMPT).toContain('never a willingness-to-pay estimate');
		expect(SYSTEM_PROMPT).toContain('consumption context only; they are not a ticket-price curve');
		expect(SYSTEM_PROMPT).toContain(
			'the first assumptions must list what is missing (comparable sales, capacity, production costs, artist fee)'
		);
	});

	it('keeps sponsor drafts hypothetical', () => {
		expect(SYSTEM_PROMPT).toContain('"We are exploring a potential concert"');
		expect(SYSTEM_PROMPT).toContain('"subject to artist and venue confirmation"');
		expect(SYSTEM_PROMPT).toContain(
			'Never promise rights, activations, inventory or brand presence; never call the brand a sponsor, only a prospect.'
		);
	});

	it('keeps the calendar out of the risk items and the ranking honest about locality', () => {
		expect(SYSTEM_PROMPT).toContain('never as risk items');
		expect(SYSTEM_PROMPT).toContain('open-meteo.com or date.nager.at are not feed items');
		expect(SYSTEM_PROMPT).toContain('artist compatibility, not locality-differentiated');
	});

	it('gives conservative verdict criteria', () => {
		expect(SYSTEM_PROMPT).toContain(
			'insufficient_data when audience, lineup or sponsors is no_coverage'
		);
		expect(SYSTEM_PROMPT).toContain('mixed when the cultural fit is contradictory');
		expect(SYSTEM_PROMPT).toContain(
			'promising only when the cultural evidence is strong on every core section'
		);
		expect(SYSTEM_PROMPT).toContain('never financial approval');
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
