import { describe, expect, it } from 'vitest';
import { neutralizeProse, neutralizeProvider } from './wording.ts';

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
