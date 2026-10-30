import type { Brief } from '$lib/brief/schema';

export interface PriceLevelDistribution {
	/** Counts of price levels 1..4 (index 0 is `$`), deduplicated by entityId. */
	fromPlaces: [number, number, number, number];
	/** Quantiles of the heatmap cells' priceLevel, or null when no cell has one. */
	fromHeatmap: { p25: number; p50: number; p75: number; p90: number } | null;
	/** Number of distinct places with a price level 1..4. */
	total: number;
}

/** Linear-interpolated quantile of an ascending-sorted, non-empty array. */
function quantile(sorted: number[], q: number): number {
	const pos = (sorted.length - 1) * q;
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function priceLevelDistribution(brief: Brief): PriceLevelDistribution {
	const counts: [number, number, number, number] = [0, 0, 0, 0];
	const seen = new Set<string>();
	for (const group of brief.artifacts.placeCandidates ?? []) {
		for (const item of group.items) {
			if (seen.has(item.entityId)) continue;
			seen.add(item.entityId);
			const level = item.priceLevel;
			if (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 4) {
				counts[level - 1] += 1;
			}
		}
	}

	const values = (brief.artifacts.heatmap?.cells ?? [])
		.map((c) => c.priceLevel)
		.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
		.sort((a, b) => a - b);
	const fromHeatmap = values.length
		? {
				p25: quantile(values, 0.25),
				p50: quantile(values, 0.5),
				p75: quantile(values, 0.75),
				p90: quantile(values, 0.9)
			}
		: null;

	return { fromPlaces: counts, fromHeatmap, total: counts.reduce((a, b) => a + b, 0) };
}
