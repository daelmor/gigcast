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

const norm = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim();

/**
 * Drops neighbourhoods of a city that is itself in the list ("The Woods, Panama City, Bay,
 * Florida" when "Panama City" is a candidate), so a search for a city is not eight entries of
 * the same place. A candidate is a sub-locality when the second segment of its disambiguation
 * names another candidate.
 */
export function dropSubLocalities(candidates: LocalityCandidate[]): LocalityCandidate[] {
	const names = new Set(candidates.map((c) => norm(c.name)));
	return candidates.filter((c) => {
		const parent = c.disambiguation?.split(',')[1]?.trim();
		return !(parent && norm(parent) !== norm(c.name) && names.has(norm(parent)));
	});
}

/** Candidates mapped 1:1, acceptable ones first (stable otherwise). */
export function toLocalityResults(candidates: LocalityCandidate[]): LocalitySearchResult[] {
	const mapped = candidates.map((c) => ({
		entityId: c.entityId,
		name: c.name,
		disambiguation: c.disambiguation,
		lat: c.lat,
		lon: c.lon,
		countryCode: c.countryCode,
		acceptable: c.acceptable
	}));
	return [...mapped.filter((c) => c.acceptable), ...mapped.filter((c) => !c.acceptable)];
}
