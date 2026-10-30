/** Pure mappers from Qloo search results to the API response shapes. */
import type { ArtistSearchResult, LocalitySearchResult } from '$lib/api/contracts';
import type { LocalityCandidate } from '../qloo/locality.ts';
import type { SearchResult } from '../qloo/schemas.ts';

function imageUrl(properties: SearchResult['properties']): string | undefined {
	const image = properties?.image;
	if (image && typeof image === 'object' && 'url' in image) {
		const url = (image as { url?: unknown }).url;
		if (typeof url === 'string' && url.length > 0) return url;
	}
	return undefined;
}

export function toArtistResult(r: SearchResult): ArtistSearchResult {
	return {
		entityId: r.entity_id,
		name: r.name,
		disambiguation: r.disambiguation ?? undefined,
		popularity: r.popularity ?? null,
		image: imageUrl(r.properties),
		tags: (r.tags ?? []).slice(0, 5).flatMap((t) => (t.name ? [t.name] : []))
	};
}

/** Candidates mapped 1:1, acceptable ones first (stable otherwise). */
export function toLocalityResults(candidates: LocalityCandidate[]): LocalitySearchResult[] {
	const mapped = candidates.map((c) => ({
		entityId: c.entityId,
		name: c.name,
		disambiguation: c.disambiguation,
		lat: c.lat,
		lon: c.lon,
		acceptable: c.acceptable
	}));
	return [...mapped.filter((c) => c.acceptable), ...mapped.filter((c) => !c.acceptable)];
}
