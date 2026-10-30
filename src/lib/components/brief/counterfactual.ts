import type { CounterfactualMatch, CounterfactualPanel } from '$lib/brief/schema';
import { pct } from './format';

export type MatchTone = 'overlap' | 'in_qloo' | 'absent';

export function matchLine(match: CounterfactualMatch | undefined): {
	tone: MatchTone;
	text: string;
} {
	if (match?.pickedByGroundedRun) {
		return { tone: 'overlap', text: 'Also picked by the grounded run' };
	}
	if (match?.entityId) {
		const affinity = match.affinity !== undefined ? ` · affinity ${pct(match.affinity)}` : '';
		return { tone: 'in_qloo', text: `Also in Qloo's results${affinity}` };
	}
	return { tone: 'absent', text: "Not in Qloo's results for this run" };
}

type Summary = NonNullable<CounterfactualPanel['summary']>;

export function summaryLines(summary: Summary): { lineup: string; sponsors: string } {
	return {
		lineup: `${summary.lineupInQloo} of ${summary.lineupTotal} LLM-only lineup picks appear in Qloo's results, ${summary.lineupOverlap} also chosen by the grounded run`,
		sponsors: `${summary.sponsorsInQloo} of ${summary.sponsorsTotal} LLM-only sponsor picks appear in Qloo's results, ${summary.sponsorsOverlap} also chosen by the grounded run`
	};
}

/** Pairs each LLM-only pick with its match (parallel arrays). */
export function comparisonRows<T>(
	picks: T[],
	matches: CounterfactualMatch[] | undefined
): { pick: T; match: CounterfactualMatch | undefined }[] {
	return picks.map((pick, i) => ({ pick, match: matches?.[i] }));
}
