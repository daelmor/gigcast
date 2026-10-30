/**
 * Source numbering for the web document. Mirrors `renderBriefMarkdown`: sources
 * are numbered by first citation in document order, then the remaining refs in
 * artifact order, so [S3] means the same thing in the web and in the Markdown.
 */
import type { Brief, SourceRef } from '$lib/brief/schema';

export interface SourceIndex {
	order: SourceRef[];
	indexByCallId: Map<string, number>;
}

/** Every distinct SourceRef in the artifacts, in artifact order (as in markdown.ts). */
export function collectSourceRefs(brief: Brief): SourceRef[] {
	const a = brief.artifacts;
	const candidates: Array<SourceRef | undefined> = [
		a.heatmap?.source,
		a.neighbourhoods?.source,
		a.demographics?.source,
		a.trending?.source,
		a.artistTags?.source,
		a.cityTags?.source,
		a.cityArtists?.source,
		a.lineupCandidates?.source,
		a.sponsorCandidates?.source,
		...(a.placeCandidates ?? []).map((p) => p.source),
		...(a.calls ?? [])
	];
	const seen = new Map<string, SourceRef>();
	for (const ref of candidates) {
		if (ref && !seen.has(ref.toolCallId)) seen.set(ref.toolCallId, ref);
	}
	return [...seen.values()];
}

export function buildSourceIndex(brief: Brief): SourceIndex {
	const refs = collectSourceRefs(brief);
	const known = new Map(refs.map((r) => [r.toolCallId, r]));
	const indexByCallId = new Map<string, number>();
	const order: SourceRef[] = [];
	const cite = (ids: readonly (string | undefined)[] | undefined) => {
		for (const id of ids ?? []) {
			if (!id || indexByCallId.has(id)) continue;
			const ref = known.get(id);
			if (!ref) continue;
			order.push(ref);
			indexByCallId.set(id, order.length);
		}
	};

	const { draft, artifacts: a } = brief;
	for (const h of draft.audience.hotspots) cite(h.sources);
	cite([a.heatmap?.source.toolCallId]);
	const d = draft.demandAndFit;
	if (d.trend) cite([a.trending?.source.toolCallId]);
	if (d.tasteMatch) cite([a.artistTags?.source.toolCallId, a.cityTags?.source.toolCallId]);
	cite([a.demographics?.source.toolCallId]);
	for (const p of draft.lineup.picks) cite(p.sources);
	for (const p of draft.sponsors.picks) cite(p.sources);
	for (const p of draft.venuesAndPartners.picks) cite(p.sources);
	cite(refs.map((r) => r.toolCallId));
	return { order, indexByCallId };
}
