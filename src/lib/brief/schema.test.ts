import { describe, expect, it } from 'vitest';
import { sampleBrief } from './fixtures/sample-brief';
import { briefDraftSchema, briefInputSchema, briefSchema } from './schema';

const minimalDraft = {
	headline: 'Short headline',
	verdict: 'mixed',
	keyPoints: ['One point'],
	audience: { note: { label: 'grounded', summary: 'Audience.' } },
	demandAndFit: { note: { label: 'inferred', summary: 'Demand.' } },
	lineup: { note: { label: 'no_coverage', summary: 'Lineup.' } },
	sponsors: { note: { label: 'no_coverage', summary: 'Sponsors.' } },
	venuesAndPartners: { note: { label: 'no_coverage', summary: 'Venues.' } },
	pricing: { note: { label: 'inferred', summary: 'Pricing.' }, currency: 'GTQ' }
};

describe('briefSchema', () => {
	it('round-trips the sample brief', () => {
		const parsed = briefSchema.parse(sampleBrief);
		expect(parsed).toEqual(sampleBrief);
		expect(briefSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
	});

	it('rejects an invalid label', () => {
		const bad = structuredClone(sampleBrief) as unknown as {
			draft: { lineup: { picks: Array<{ label: string }> } };
		};
		bad.draft.lineup.picks[0].label = 'guessed';
		expect(briefSchema.safeParse(bad).success).toBe(false);
	});
});

describe('briefDraftSchema', () => {
	it('applies defaults to a minimal draft', () => {
		const draft = briefDraftSchema.parse(minimalDraft);
		expect(draft.openQuestions).toEqual([]);
		expect(draft.audience.hotspots).toEqual([]);
		expect(draft.audience.note.caveats).toEqual([]);
		expect(draft.lineup.picks).toEqual([]);
		expect(draft.pricing.tiers).toEqual([]);
		expect(draft.risks).toBeUndefined();
	});

	it('defaults item sources to an empty array', () => {
		const draft = briefDraftSchema.parse({
			...minimalDraft,
			audience: {
				note: { label: 'grounded', summary: 'Audience.' },
				hotspots: [{ name: 'Zona 10', lat: 14.6, lon: -90.5, why: 'Peak.', label: 'grounded' }]
			}
		});
		expect(draft.audience.hotspots[0].sources).toEqual([]);
	});
});

describe('briefInputSchema', () => {
	const base = {
		artist: 'Ricardo Arjona',
		city: 'Guatemala City',
		country: 'GT',
		dateFrom: '2026-11-20',
		dateTo: '2026-11-22'
	};

	it('accepts a valid input', () => {
		expect(briefInputSchema.safeParse(base).success).toBe(true);
	});

	it('rejects a bad date format', () => {
		expect(briefInputSchema.safeParse({ ...base, dateFrom: '20/11/2026' }).success).toBe(false);
		expect(briefInputSchema.safeParse({ ...base, dateTo: '2026-11-22T00:00:00Z' }).success).toBe(
			false
		);
	});
});
