import { describe, expect, it } from 'vitest';
import { fallbackDraft } from '../server/agent/assemble.ts';
import { sampleBrief } from './fixtures/sample-brief.ts';
import type { Brief, SectionNote } from './schema.ts';
import {
	buildDecisionSnapshot,
	criticalUnknowns,
	headlineClause,
	NO_NEIGHBOURHOODS,
	NOT_AVAILABLE,
	signalBand,
	SPONSOR_SUFFIX
} from './snapshot.ts';
import { VERDICT_LABEL, VERDICT_NEXT_STEP } from './verdict.ts';

const noCoverage = (summary: string): SectionNote => ({
	label: 'no_coverage',
	summary,
	caveats: []
});

/** The sample brief with a neighbourhood ranking attached (the fixture has none). */
function withNeighbourhoods(
	items = [
		{ entityId: 'z10', name: 'Zona 10', affinity: 0.9 },
		{ entityId: 'z4', name: 'Zona 4', affinity: 0.7 }
	]
): Brief {
	const brief = structuredClone(sampleBrief);
	brief.artifacts.neighbourhoods = { items, source: sampleBrief.artifacts.heatmap!.source };
	return brief;
}

function withTasteScore(brief: Brief, score: number): Brief {
	const out = structuredClone(brief);
	out.draft.demandAndFit.tasteMatch!.score = score;
	out.draft.demandAndFit.tasteMatch!.label = 'grounded';
	return out;
}

describe('headlineClause', () => {
	it('takes the claim after an "Artist in City" title', () => {
		expect(
			headlineClause(
				'Bad Bunny in Los Angeles: 99th-percentile global artist meets a large Latino metro — arena-to-stadium opportunity'
			)
		).toBe('99th-percentile global artist meets a large Latino metro');
		expect(headlineClause('Rick Ross in Tampa — strong local taste fit; Ybor City is a hub.')).toBe(
			'Strong local taste fit'
		);
	});

	it('keeps the first clause when the headline has no title part', () => {
		expect(
			headlineClause(
				'Janelle Monáe is a near-perfect taste match for NYC — but flat momentum means marketing will need to work.'
			)
		).toBe('Janelle Monáe is a near-perfect taste match for NYC');
	});

	it('caps long clauses at a word boundary', () => {
		const long = `${'word '.repeat(60)}end`;
		const clause = headlineClause(long);
		expect(clause.length).toBeLessThanOrEqual(161);
		expect(clause.endsWith('…')).toBe(true);
	});
});

describe('signalBand', () => {
	it('is low below 0.30, moderate up to 0.60, strong above', () => {
		expect(signalBand(0)).toBe('low');
		expect(signalBand(0.29)).toBe('low');
		expect(signalBand(0.3)).toBe('moderate');
		expect(signalBand(0.45)).toBe('moderate');
		expect(signalBand(0.6)).toBe('moderate');
		expect(signalBand(0.61)).toBe('strong');
		expect(signalBand(1)).toBe('strong');
	});
});

describe('criticalUnknowns', () => {
	it('lists four unknowns without promoter inputs, named by the schema fields', () => {
		const out = criticalUnknowns(undefined);
		expect(out).toHaveLength(4);
		expect(out[0]).toMatch(/^Artist fee and availability/);
		expect(out.join(' ')).toContain('venues[].capacity');
		expect(out.join(' ')).toContain('pastSales');
		expect(out.join(' ')).toContain('ticketPriceRange');
	});

	it('drops what the promoter supplied, never the fee', () => {
		const out = criticalUnknowns({
			venues: [{ name: 'Stadium', capacity: 12000 }],
			ticketPriceRange: { min: 10, max: 90, currency: 'USD' },
			pastSales: [{ event: 'Last tour', sold: 9000 }]
		});
		expect(out).toEqual([
			'Artist fee and availability: not in the data; request a quote and a hold.'
		]);
		// A venue without a capacity does not count as capacity.
		expect(criticalUnknowns({ venues: [{ name: 'Club' }] }).join(' ')).toContain('Venue capacity');
	});
});

describe('buildDecisionSnapshot', () => {
	it('derives every line from the full sample brief', () => {
		const snap = buildDecisionSnapshot(sampleBrief);
		expect(snap.verdict).toBe('promising');
		expect(snap.assessment).toBe(
			`${VERDICT_LABEL.promising}. Strong home-market cultural fit with clear sponsor prospects.`
		);
		expect(snap.fitSignal.kind).toBe('taste_match');
		expect(snap.fitSignal.text).toBe('Taste match with the city: 86% (strong)');
		expect(snap.fitSignal.band).toBe('strong');
		expect(snap.fitSignal.sources).toEqual(['toolu_01E', 'toolu_01D']);
		expect(snap.coverage).toBeUndefined();
		expect(snap.topSponsor?.name).toBe('Adidas');
		expect(snap.topSponsor?.text).toBe(`Adidas (affinity 91%), ${SPONSOR_SUFFIX}`);
		// The fixture promoter supplied a venue with capacity and a price range, no past sales.
		expect(snap.unknowns).toHaveLength(2);
		expect(snap.unknowns[1]).toMatch(/^Comparable sales history/);
		expect(snap.nextStep).toBe(VERDICT_NEXT_STEP.promising);
		expect(snap.confidence.cultural).toBe('strong');
		expect(snap.confidence.culturalText).toBe(
			'Cultural evidence strong: 5 of 5 sections grounded.'
		);
		expect(snap.confidence.businessText).toMatch(/^Business case not validated/);
	});

	it('qualifies the signal by band', () => {
		expect(buildDecisionSnapshot(withTasteScore(sampleBrief, 0.15)).fitSignal.text).toBe(
			'Taste match with the city: 15% (low)'
		);
		expect(buildDecisionSnapshot(withTasteScore(sampleBrief, 0.45)).fitSignal.text).toBe(
			'Taste match with the city: 45% (moderate)'
		);
		expect(buildDecisionSnapshot(withTasteScore(sampleBrief, 0.95)).fitSignal.text).toBe(
			'Taste match with the city: 95% (strong)'
		);
	});

	it('adds the highest-affinity neighbourhood and reads mixed when the signal is low', () => {
		const snap = buildDecisionSnapshot(withTasteScore(withNeighbourhoods(), 0.15));
		expect(snap.fitSignal.band).toBe('low');
		expect(snap.coverage).toEqual({
			text: 'Zona 10, affinity 90%',
			label: 'grounded',
			sources: [sampleBrief.artifacts.heatmap!.source.toolCallId]
		});
		expect(snap.confidence.cultural).toBe('mixed');
		expect(snap.confidence.culturalText).toBe(
			'Cultural evidence mixed: 5 of 5 sections grounded, but the cultural fit signal is low.'
		);
		// Moderate and strong signals add no second line and leave the evidence reading alone.
		const moderate = buildDecisionSnapshot(withTasteScore(withNeighbourhoods(), 0.45));
		expect(moderate.coverage).toBeUndefined();
		expect(moderate.confidence.cultural).toBe('strong');
	});

	it('says so when a low signal has no neighbourhood ranking, and never upgrades sparse evidence', () => {
		const noHoods = buildDecisionSnapshot(withTasteScore(sampleBrief, 0.1));
		expect(noHoods.coverage).toEqual({ text: NO_NEIGHBOURHOODS, sources: [] });
		const sparse = withTasteScore(withNeighbourhoods(), 0.1);
		sparse.draft.lineup.note = noCoverage('Nothing.');
		sparse.draft.sponsors.note = noCoverage('Nothing.');
		expect(buildDecisionSnapshot(sparse).confidence.cultural).toBe('sparse');
	});

	it('lists every unknown when there are no promoter inputs', () => {
		const brief: Brief = { ...sampleBrief, input: { ...sampleBrief.input, promoter: undefined } };
		expect(buildDecisionSnapshot(brief).unknowns).toHaveLength(4);
	});

	it('falls back to the neighbourhood signal, then the brand, when the taste match is not grounded', () => {
		const brief = withNeighbourhoods();
		brief.draft.demandAndFit.tasteMatch!.label = 'inferred';
		const hood = buildDecisionSnapshot(brief).fitSignal;
		expect(hood.kind).toBe('neighbourhood');
		expect(hood.text).toBe('Strongest neighbourhood: Zona 10, affinity 90% (strong)');
		expect(hood.band).toBe('strong');
		brief.artifacts.neighbourhoods = undefined;
		const brand = buildDecisionSnapshot(brief).fitSignal;
		expect(brand.kind).toBe('brand');
		expect(brand.text).toBe('Top brand affinity: Adidas 91% (strong)');
		brief.draft.sponsors.picks = [];
		const none = buildDecisionSnapshot(brief);
		expect(none.fitSignal.text).toBe(NOT_AVAILABLE);
		expect(none.fitSignal.band).toBeUndefined();
		expect(none.coverage).toBeUndefined();
		expect(none.topSponsor).toBeUndefined();
	});

	it('says broad coverage when the neighbourhoods do not differ', () => {
		const brief = withNeighbourhoods(
			Array.from({ length: 10 }, (_, i) => ({
				entityId: `h${i}`,
				name: `Comuna ${i}`,
				affinity: 0.804
			}))
		);
		brief.draft.demandAndFit.tasteMatch = undefined;
		const signal = buildDecisionSnapshot(brief).fitSignal;
		expect(signal.kind).toBe('neighbourhood');
		expect(signal.text).toBe(
			'Broad audience affinity across 8 neighbourhoods at about 80% (strong), with no meaningful differentiation'
		);
	});

	it('reads sparse evidence from no_coverage sections', () => {
		const brief = structuredClone(sampleBrief);
		brief.draft.lineup.note = noCoverage('Nothing.');
		brief.draft.sponsors.note = noCoverage('Nothing.');
		brief.draft.verdict = 'insufficient_data';
		const snap = buildDecisionSnapshot(brief);
		expect(snap.confidence).toMatchObject({ cultural: 'sparse', grounded: 3, noCoverage: 2 });
		expect(snap.confidence.culturalText).toBe(
			'Cultural evidence sparse: 3 of 5 sections grounded, 2 with no coverage.'
		);
		expect(snap.nextStep).toBe(VERDICT_NEXT_STEP.insufficient_data);
		// One inferred section among grounded ones reads as mixed.
		const mixed = structuredClone(sampleBrief);
		mixed.draft.venuesAndPartners.note.label = 'inferred';
		expect(buildDecisionSnapshot(mixed).confidence.cultural).toBe('mixed');
	});

	it('renders Not available for a partial brief that never reached emit_brief', () => {
		const brief: Brief = {
			...sampleBrief,
			draft: fallbackDraft('Request was aborted.'),
			artifacts: { calls: [] },
			input: { ...sampleBrief.input, promoter: undefined }
		};
		const snap = buildDecisionSnapshot(brief);
		expect(snap.verdict).toBe('insufficient_data');
		expect(snap.assessment).toBe(
			`${VERDICT_LABEL.insufficient_data}. The agent did not deliver a full brief.`
		);
		expect(snap.fitSignal.text).toBe(NOT_AVAILABLE);
		expect(snap.topSponsor).toBeUndefined();
		expect(snap.confidence.cultural).toBe('sparse');
		expect(snap.unknowns).toHaveLength(4);
	});
});
