import { describe, expect, it } from 'vitest';
import { sampleBrief } from '$lib/brief/fixtures/sample-brief';
import { comparisonRows, matchLine, summaryLines } from './counterfactual';

const panel = sampleBrief.counterfactual!;

describe('matchLine', () => {
	it('flags picks also chosen by the grounded run', () => {
		expect(matchLine(panel.matches!.lineup[0])).toEqual({
			tone: 'overlap',
			text: 'Also picked by the grounded run'
		});
	});
	it('shows affinity for picks present in Qloo only', () => {
		expect(matchLine(panel.matches!.lineup[1])).toEqual({
			tone: 'in_qloo',
			text: "Also in Qloo's results · affinity 71%"
		});
	});
	it('handles absent and missing matches', () => {
		expect(matchLine(panel.matches!.sponsors[3]).tone).toBe('absent');
		expect(matchLine(undefined).text).toBe("Not in Qloo's results for this run");
	});
});

describe('summaryLines and comparisonRows', () => {
	it('words the counts from the fixture', () => {
		const lines = summaryLines(panel.summary!);
		expect(lines.lineup).toBe(
			"2 of 4 LLM-only lineup picks appear in Qloo's results, 1 also chosen by the grounded run"
		);
		expect(lines.sponsors).toContain('2 of 4 LLM-only sponsor picks');
	});
	it('keeps the fixture summary consistent with its matches', () => {
		const m = panel.matches!.sponsors;
		expect(m.filter((x) => x.entityId).length).toBe(panel.summary!.sponsorsInQloo);
		expect(m.filter((x) => x.pickedByGroundedRun).length).toBe(panel.summary!.sponsorsOverlap);
	});
	it('pairs picks with matches by index', () => {
		const rows = comparisonRows(panel.draft!.lineup, panel.matches!.lineup);
		expect(rows).toHaveLength(4);
		expect(rows[0].match?.qlooName).toBe('Gaby Moreno');
	});
});
