import { describe, expect, it } from 'vitest';
import { sampleBrief } from './fixtures/sample-brief.ts';
import { lineupLocalityDifferentiated } from './lineup.ts';
import type { Brief } from './schema.ts';

const HEADLINER = sampleBrief.resolution.artist.entityId;

function withExplainability(
	explainability: Record<string, { entityId: string; score: number }[]> | undefined
): Brief {
	const brief = structuredClone(sampleBrief);
	const candidates = brief.artifacts.lineupCandidates!;
	candidates.items = candidates.items.map((c) => ({ ...c, explainability }));
	return brief;
}

describe('lineupLocalityDifferentiated', () => {
	it('is undefined when no candidate carries explainability', () => {
		expect(lineupLocalityDifferentiated(withExplainability(undefined))).toBeUndefined();
	});

	it('is false when every weight is the headliner under the entity signal', () => {
		const brief = withExplainability({
			'signal.interests.entities': [{ entityId: HEADLINER.toLowerCase(), score: 1 }]
		});
		expect(lineupLocalityDifferentiated(brief)).toBe(false);
	});

	it('is true when a locality signal or another entity contributes', () => {
		expect(
			lineupLocalityDifferentiated(
				withExplainability({
					'signal.interests.entities': [{ entityId: HEADLINER, score: 0.7 }],
					'signal.location': [{ entityId: 'LOCALITY', score: 0.3 }]
				})
			)
		).toBe(true);
		expect(
			lineupLocalityDifferentiated(
				withExplainability({
					'signal.interests.entities': [
						{ entityId: HEADLINER, score: 0.8 },
						{ entityId: 'OTHER-ARTIST', score: 0.2 }
					]
				})
			)
		).toBe(true);
	});
});
