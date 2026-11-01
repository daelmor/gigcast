import { describe, expect, it } from 'vitest';
import { fallbackDraft } from '../server/agent/assemble.ts';
import { sampleBrief } from './fixtures/sample-brief.ts';
import type { Brief, SectionNote } from './schema.ts';
import {
	buildDecisionSnapshot,
	criticalUnknowns,
	headlineClause,
	NOT_AVAILABLE,
	SPONSOR_SUFFIX
} from './snapshot.ts';
import { VERDICT_LABEL, VERDICT_NEXT_STEP } from './verdict.ts';

const noCoverage = (summary: string): SectionNote => ({
	label: 'no_coverage',
	summary,
	caveats: []
});

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
		expect(snap.strongestSignal.kind).toBe('taste_match');
		expect(snap.strongestSignal.text).toBe('Taste match with the city 86%');
		expect(snap.strongestSignal.sources).toEqual(['toolu_01E', 'toolu_01D']);
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

	it('lists every unknown when there are no promoter inputs', () => {
		const brief: Brief = { ...sampleBrief, input: { ...sampleBrief.input, promoter: undefined } };
		expect(buildDecisionSnapshot(brief).unknowns).toHaveLength(4);
	});

	it('falls back to the neighbourhood signal, then the brand, when the taste match is not grounded', () => {
		const brief = structuredClone(sampleBrief);
		brief.draft.demandAndFit.tasteMatch!.label = 'inferred';
		brief.artifacts.neighbourhoods = {
			items: [
				{ entityId: 'z10', name: 'Zona 10', affinity: 0.9 },
				{ entityId: 'z4', name: 'Zona 4', affinity: 0.7 }
			],
			source: sampleBrief.artifacts.heatmap!.source
		};
		const hood = buildDecisionSnapshot(brief).strongestSignal;
		expect(hood.kind).toBe('neighbourhood');
		expect(hood.text).toBe('Strongest neighbourhood: Zona 10, affinity 90%');
		brief.artifacts.neighbourhoods = undefined;
		const brand = buildDecisionSnapshot(brief).strongestSignal;
		expect(brand.kind).toBe('brand');
		expect(brand.text).toBe('Top brand affinity: Adidas 91%');
		brief.draft.sponsors.picks = [];
		const none = buildDecisionSnapshot(brief);
		expect(none.strongestSignal.text).toBe(NOT_AVAILABLE);
		expect(none.topSponsor).toBeUndefined();
	});

	it('says broad coverage when the neighbourhoods do not differ', () => {
		const brief = structuredClone(sampleBrief);
		brief.draft.demandAndFit.tasteMatch = undefined;
		brief.artifacts.neighbourhoods = {
			items: Array.from({ length: 10 }, (_, i) => ({
				entityId: `h${i}`,
				name: `Comuna ${i}`,
				affinity: 0.804
			})),
			source: sampleBrief.artifacts.heatmap!.source
		};
		const signal = buildDecisionSnapshot(brief).strongestSignal;
		expect(signal.kind).toBe('neighbourhood');
		expect(signal.text).toBe(
			'Broad audience affinity across 8 neighbourhoods at about 80%, with no meaningful differentiation'
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
		expect(snap.strongestSignal.text).toBe(NOT_AVAILABLE);
		expect(snap.topSponsor).toBeUndefined();
		expect(snap.confidence.cultural).toBe('sparse');
		expect(snap.unknowns).toHaveLength(4);
	});
});
