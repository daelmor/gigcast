/**
 * Does the lineup ranking carry any locality signal? The similar-artists call asks for
 * explainability with the headliner and the locality as signals; in practice the graph often
 * returns the headliner signal alone at 1.0 for every candidate. Then the ranking is artist
 * compatibility and must not be sold as local relevance. Pure, shared by UI and Markdown.
 */
import type { Brief, Candidate } from './schema';

const HEADLINER_SIGNAL = 'signal.interests.entities';

/**
 * undefined when no candidate carries explainability (nothing to say); false when every
 * candidate's explainability is the headliner entity under the headliner signal only; true
 * when any candidate shows another signal (locality, demographics) or another entity.
 */
export function lineupLocalityDifferentiated(brief: Brief): boolean | undefined {
	const headliner = brief.resolution.artist.entityId.toLowerCase();
	const candidates = brief.artifacts.lineupCandidates?.items ?? [];
	const byId = new Map(candidates.map((c) => [c.entityId.toLowerCase(), c]));
	const picked = brief.draft.lineup.picks
		.map((p) => byId.get(p.entityId.toLowerCase()))
		.filter((c): c is Candidate => c !== undefined);
	const considered = (picked.length ? picked : candidates).filter((c) => c.explainability);
	if (considered.length === 0) return undefined;
	for (const c of considered) {
		for (const [signal, rows] of Object.entries(c.explainability ?? {})) {
			if (signal !== HEADLINER_SIGNAL) return true;
			if (rows.some((r) => r.entityId.toLowerCase() !== headliner)) return true;
		}
	}
	return false;
}

export const LINEUP_ARTIST_ONLY_SUBTITLE = 'Artist compatibility (not locality-differentiated)';
export const LINEUP_ARTIST_ONLY_NOTE =
	"The ranking comes from the headliner's audience overlap alone; the explainability shows no locality contribution, so the order says nothing about this city in particular.";
