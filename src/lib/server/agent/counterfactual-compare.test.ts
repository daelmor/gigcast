import { describe, expect, it } from 'vitest';
import { sampleBrief } from '../../brief/fixtures/sample-brief.ts';
import type { Brief, CounterfactualDraft } from '../../brief/schema.ts';
import { compareCounterfactual, findByName, normalizeName } from './counterfactual-compare.ts';

describe('normalizeName', () => {
	it('ignores accents, case, punctuation and leading articles', () => {
		expect(normalizeName('Café Tacvba')).toBe('cafe tacvba');
		expect(normalizeName('Los Ángeles Azules')).toBe('angeles azules');
		expect(normalizeName('H&M')).toBe('h and m');
		expect(normalizeName('  The Weeknd ')).toBe('weeknd');
	});
});

describe('findByName', () => {
	const candidates = [
		{ entityId: 'a', name: 'Gaby Moreno', affinity: 0.9 },
		{ entityId: 'b', name: 'Cervecería Nacional Dominicana', affinity: 0.8 }
	];
	it('matches exactly after normalization', () => {
		expect(findByName('gaby moreno', candidates)?.entityId).toBe('a');
	});
	it('matches multi-word names by containment', () => {
		expect(findByName('Cerveceria Nacional', candidates)?.entityId).toBe('b');
	});
	it('does not match single words by containment', () => {
		expect(findByName('Nacional', candidates)).toBeUndefined();
	});
});

describe('compareCounterfactual', () => {
	const groundedLineup = sampleBrief.draft.lineup.picks[0].name;
	const qlooOnly = sampleBrief.artifacts.lineupCandidates!.items.find(
		(c) => !sampleBrief.draft.lineup.picks.some((p) => p.entityId === c.entityId)
	);
	const sponsor = sampleBrief.draft.sponsors.picks[0].name;

	const draft: CounterfactualDraft = {
		lineup: [
			{ name: groundedLineup, role: 'co_headliner', why: 'same pick', confidence: 'high' },
			...(qlooOnly
				? [
						{
							name: qlooOnly.name,
							role: 'opener' as const,
							why: 'in qloo only',
							confidence: 'medium' as const
						}
					]
				: []),
			{ name: 'Totally Made Up Band', role: 'support', why: 'guess', confidence: 'low' }
		],
		sponsors: [
			{ name: sponsor, category: 'x', why: 'same pick', confidence: 'high' },
			{ name: 'Nonexistent Brand Co', category: 'y', why: 'guess', confidence: 'low' }
		],
		caveats: []
	};

	it('marks overlap with the grounded run, presence in Qloo results and absence', () => {
		const { matches, summary } = compareCounterfactual(draft, sampleBrief as Brief);
		expect(matches!.lineup[0].pickedByGroundedRun).toBe(true);
		expect(matches!.lineup[0].entityId).toBeDefined();
		if (qlooOnly) {
			expect(matches!.lineup[1].entityId).toBe(qlooOnly.entityId);
			expect(matches!.lineup[1].pickedByGroundedRun).toBe(false);
		}
		const last = matches!.lineup[matches!.lineup.length - 1];
		expect(last.entityId).toBeUndefined();
		expect(last.pickedByGroundedRun).toBe(false);
		expect(summary!.lineupTotal).toBe(draft.lineup.length);
		expect(summary!.lineupOverlap).toBe(1);
		expect(summary!.sponsorsTotal).toBe(2);
		expect(summary!.sponsorsInQloo).toBe(1);
		expect(summary!.sponsorsOverlap).toBe(1);
	});
});
