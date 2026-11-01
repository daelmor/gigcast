/**
 * Neighbourhood ranking without false precision. The heatmap-by-locality call returns the same
 * place under several entities ("Brooklyn" twice, "New York" and "New York County") and, in many
 * markets, a dozen localities at exactly the same affinity. A ranked top list then invents an
 * order that is not in the data. Pure, shared by the assembler, the UI and the snapshot.
 */

export interface Neighbourhood {
	entityId: string;
	name: string;
	affinity: number;
}

/** Top affinities closer than this read as "no differentiation". */
export const FLAT_SPREAD = 0.02;

export function normalizeNeighbourhoodName(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Dedupe by entity id, then by normalized name, keeping the highest affinity; sorted by affinity. */
export function dedupeNeighbourhoods(items: readonly Neighbourhood[]): Neighbourhood[] {
	const byId = new Map<string, Neighbourhood>();
	for (const item of items) {
		const key = item.entityId.toLowerCase();
		const seen = byId.get(key);
		if (!seen || item.affinity > seen.affinity) byId.set(key, item);
	}
	const byName = new Map<string, Neighbourhood>();
	for (const item of byId.values()) {
		const key = normalizeNeighbourhoodName(item.name) || item.entityId.toLowerCase();
		const seen = byName.get(key);
		if (!seen || item.affinity > seen.affinity) byName.set(key, item);
	}
	return [...byName.values()].sort((a, b) => b.affinity - a.affinity);
}

export interface NeighbourhoodRanking {
	/** Deduped, highest affinity first, at most `top` items. */
	items: Neighbourhood[];
	/** True when the shown affinities are within FLAT_SPREAD of each other: no meaningful order. */
	flat: boolean;
	/** Highest minus lowest shown affinity. */
	spread: number;
}

export function rankNeighbourhoods(items: readonly Neighbourhood[], top = 8): NeighbourhoodRanking {
	const shown = dedupeNeighbourhoods(items).slice(0, top);
	if (shown.length === 0) return { items: shown, flat: false, spread: 0 };
	const spread = shown[0].affinity - shown[shown.length - 1].affinity;
	return { items: shown, flat: shown.length >= 2 && spread <= FLAT_SPREAD, spread };
}

export const FLAT_NEIGHBOURHOODS_HEADING =
	'Broad coverage, no meaningful neighbourhood differentiation in this result';
