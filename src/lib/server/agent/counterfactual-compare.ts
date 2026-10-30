/**
 * Compare the LLM-only picks with what Qloo returned in the main run. Pure:
 * name normalization and lookups only, so it is easy to test and to reuse.
 */
import type {
	Brief,
	CounterfactualDraft,
	CounterfactualMatch,
	CounterfactualPanel
} from '../../brief/schema.ts';

/** Accent-insensitive, lower-case, alphanumeric-only, without a leading article. */
export function normalizeName(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/^(the|los|las|el|la) /, '');
}

interface Named {
	entityId: string;
	name: string;
	affinity?: number;
}

/** Exact normalized match first, then containment for names of at least two words. */
export function findByName<T extends Named>(name: string, candidates: T[]): T | undefined {
	const target = normalizeName(name);
	if (!target) return undefined;
	const exact = candidates.find((c) => normalizeName(c.name) === target);
	if (exact) return exact;
	if (!target.includes(' ')) return undefined;
	return candidates.find((c) => {
		const n = normalizeName(c.name);
		return n.length >= 4 && (n.includes(target) || target.includes(n));
	});
}

function lineupCandidates(brief: Brief): Named[] {
	const a = brief.artifacts;
	return [...(a.lineupCandidates?.items ?? []), ...(a.cityArtists?.items ?? [])];
}

function sponsorCandidates(brief: Brief): Named[] {
	return brief.artifacts.sponsorCandidates?.items ?? [];
}

function matchPicks(
	names: string[],
	candidates: Named[],
	groundedNames: string[]
): CounterfactualMatch[] {
	const grounded = new Set(groundedNames.map(normalizeName));
	return names.map((name) => {
		const found = findByName(name, candidates);
		const pickedByGroundedRun =
			grounded.has(normalizeName(name)) ||
			(found !== undefined && grounded.has(normalizeName(found.name)));
		return {
			entityId: found?.entityId,
			qlooName: found?.name,
			affinity: found?.affinity,
			pickedByGroundedRun
		};
	});
}

export function compareCounterfactual(
	draft: CounterfactualDraft,
	brief: Brief
): Pick<CounterfactualPanel, 'matches' | 'summary'> {
	const lineup = matchPicks(
		draft.lineup.map((p) => p.name),
		lineupCandidates(brief),
		brief.draft.lineup.picks.map((p) => p.name)
	);
	const sponsors = matchPicks(
		draft.sponsors.map((p) => p.name),
		sponsorCandidates(brief),
		brief.draft.sponsors.picks.map((p) => p.name)
	);
	const count = (m: CounterfactualMatch[]) => ({
		total: m.length,
		inQloo: m.filter((x) => x.entityId).length,
		overlap: m.filter((x) => x.pickedByGroundedRun).length
	});
	const l = count(lineup);
	const s = count(sponsors);
	return {
		matches: { lineup, sponsors },
		summary: {
			lineupTotal: l.total,
			lineupInQloo: l.inQloo,
			lineupOverlap: l.overlap,
			sponsorsTotal: s.total,
			sponsorsInQloo: s.inQloo,
			sponsorsOverlap: s.overlap
		}
	};
}
