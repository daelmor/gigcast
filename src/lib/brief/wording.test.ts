import { describe, expect, it } from 'vitest';
import {
	calibrateClaims,
	calibrateProse,
	calibrateText,
	CLAIM_RULES,
	neutralizeProse,
	neutralizeProvider
} from './wording.ts';

describe('neutralizeProvider', () => {
	it('rewrites the provider name in prose and keeps sentence capitals', () => {
		expect(neutralizeProvider("Criolo is São Paulo's top artist according to Qloo's data.")).toBe(
			"Criolo is São Paulo's top artist according to the taste graph's data."
		);
		expect(neutralizeProvider('Qloo returned no cells. The signal from Qloo is strong.')).toBe(
			'The taste graph returned no cells. The signal from the taste graph is strong.'
		);
	});
	it('leaves urls, tool names and other words alone', () => {
		expect(neutralizeProvider('https://hackathon.api.qloo.com/v2/insights qloo_heatmap')).toBe(
			'https://hackathon.api.qloo.com/v2/insights qloo_heatmap'
		);
		expect(neutralizeProvider('no mention here')).toBe('no mention here');
	});
});

describe('neutralizeProse', () => {
	it('walks objects and arrays but skips identifier keys', () => {
		const out = neutralizeProse({
			why: 'Qloo links them',
			sources: ['Qloo-ish id'],
			url: 'https://x/Qloo',
			nested: [{ body: "Qloo's audience data" }]
		});
		expect(out).toEqual({
			why: 'The taste graph links them',
			sources: ['Qloo-ish id'],
			url: 'https://x/Qloo',
			nested: [{ body: "The taste graph's audience data" }]
		});
	});
});

describe('calibrateClaims', () => {
	it('turns a booked concert into a potential one in sponsor drafts', () => {
		expect(
			calibrateClaims(
				'Hi [Name],\n\nWe are producing a Dante Spinetta show in Buenos Aires on [Date].'
			)
		).toBe(
			'Hi [Name],\n\nWe are exploring a potential Dante Spinetta show in Buenos Aires on [Date].'
		);
		expect(calibrateClaims('We are organizing the event at [Venue] and can offer:')).toBe(
			'We are exploring the potential event at [Venue] and can offer:'
		);
		expect(calibrateClaims('Dear team, we are planning the arena night.')).toBe(
			'Dear team, we are exploring the potential arena night.'
		);
		expect(calibrateClaims('We are bringing Criolo to São Paulo in March 2027.')).toBe(
			'We are exploring bringing Criolo to São Paulo in March 2027.'
		);
	});

	it('reads willingness to pay as price-level affinity, except when negated', () => {
		expect(calibrateClaims('p90 = 0.95 signals a mid-to-upper-mid willingness to pay.')).toBe(
			'p90 = 0.95 signals a mid-to-upper-mid price-level affinity.'
		);
		expect(calibrateClaims('used as a proxy for Willingness To Pay')).toBe(
			'used as a proxy for price-level affinity'
		);
		const negated = [
			'reflects taste overlap, not willingness to pay a specific ticket price.',
			'a taste signal, not a willingness-to-pay metric.',
			'never willingness to pay for this event.'
		];
		for (const text of negated) expect(calibrateClaims(text)).toBe(text);
	});

	it('does not claim where the audience lives', () => {
		expect(calibrateClaims("the artist's audience lives in Harlem and Bed-Stuy")).toBe(
			"the artist's audience affinity concentrates in Harlem and Bed-Stuy"
		);
		// A different sense of the phrase is left alone.
		expect(calibrateClaims('an artist whose audience lives on Spotify')).toBe(
			'an artist whose audience lives on Spotify'
		);
	});

	it('removes the demand, price, fee and commitment claims', () => {
		expect(calibrateClaims('#1 city-taste artist with deep hometown demand')).toBe(
			'#1 city-taste artist with strong hometown cultural affinity'
		);
		expect(calibrateClaims('There is deep demand here.')).toBe(
			'There is strong cultural affinity here.'
		);
		expect(calibrateClaims('This audience accepts premium prices.')).toBe(
			'This audience shows affinity for premium price levels.'
		);
		expect(calibrateClaims('Bohemia Suburbana is a cost-effective opener.')).toBe(
			'Bohemia Suburbana is a lower-popularity opener (fee unknown).'
		);
		expect(calibrateClaims('making him a cost-effective emerging opener for the bill')).toBe(
			'making him a lower-popularity emerging opener (fee unknown) for the bill'
		);
		expect(calibrateClaims('Gallo will sponsor the show.')).toBe(
			'Gallo may be a sponsorship prospect the show.'
		);
	});

	it('leaves honest prose, numbers and placeholders untouched', () => {
		const text =
			'Affinity is an audience-overlap signal, not a ticket-demand forecast. [Venue] holds 12,000; p50 = 0.70.';
		expect(calibrateClaims(text)).toBe(text);
	});

	it('names every rule', () => {
		expect(CLAIM_RULES.length).toBeGreaterThanOrEqual(8);
		for (const rule of CLAIM_RULES) expect(rule.name).toMatch(/->/);
	});
});

describe('calibrateProse', () => {
	it('applies both passes and skips identifiers, urls and sources', () => {
		const out = calibrateProse({
			why: "Qloo's data: we are producing a show; deep demand",
			sourceUrl: 'https://open-meteo.com/willingness to pay',
			sources: ['we are producing'],
			entityId: 'deep demand'
		});
		expect(out).toEqual({
			why: "The taste graph's data: we are exploring a potential show; strong cultural affinity",
			sourceUrl: 'https://open-meteo.com/willingness to pay',
			sources: ['we are producing'],
			entityId: 'deep demand'
		});
	});

	it('calibrateText is the string form', () => {
		expect(calibrateText('Qloo says the audience lives here.')).toBe(
			'The taste graph says the audience affinity concentrates here.'
		);
	});
});
