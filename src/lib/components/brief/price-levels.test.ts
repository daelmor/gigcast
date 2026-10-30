import { describe, expect, it } from 'vitest';
import { sampleBrief } from '$lib/brief/fixtures/sample-brief';
import type { Brief } from '$lib/brief/schema';
import { priceLevelDistribution } from './price-levels';

describe('priceLevelDistribution', () => {
	it('counts place price levels and heatmap quantiles for the sample brief', () => {
		const d = priceLevelDistribution(sampleBrief);
		const ids = new Set<string>();
		const expected = [0, 0, 0, 0];
		for (const g of sampleBrief.artifacts.placeCandidates ?? [])
			for (const i of g.items)
				if (!ids.has(i.entityId)) {
					ids.add(i.entityId);
					if (i.priceLevel) expected[i.priceLevel - 1]++;
				}
		expect(d.fromPlaces).toEqual(expected);
		expect(d.total).toBe(expected.reduce((a, b) => a + b, 0));
		expect(d.total).toBeGreaterThan(0);
		expect(d.fromHeatmap).not.toBeNull();
		const h = d.fromHeatmap!;
		expect(h.p25).toBeLessThanOrEqual(h.p50);
		expect(h.p50).toBeLessThanOrEqual(h.p75);
		expect(h.p75).toBeLessThanOrEqual(h.p90);
	});

	it('deduplicates places by entityId across groups', () => {
		const item = { entityId: 'x', name: 'X', priceLevel: 3 };
		const source = sampleBrief.artifacts.calls[0];
		const brief = {
			...sampleBrief,
			artifacts: {
				...sampleBrief.artifacts,
				placeCandidates: [
					{ kind: 'bar', items: [item], source },
					{ kind: 'restaurant', items: [item], source }
				]
			}
		} as Brief;
		expect(priceLevelDistribution(brief).fromPlaces).toEqual([0, 0, 1, 0]);
	});

	it('returns empty values for a brief with no places or heatmap', () => {
		const brief = {
			...sampleBrief,
			artifacts: { ...sampleBrief.artifacts, placeCandidates: undefined, heatmap: undefined }
		} as Brief;
		expect(priceLevelDistribution(brief)).toEqual({
			fromPlaces: [0, 0, 0, 0],
			fromHeatmap: null,
			total: 0
		});
	});
});
