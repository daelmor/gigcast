/**
 * Agent tools: thin, typed wrappers over the Qloo client. Every tool records
 * what it returned (raw candidates, cells, series) and which Qloo requests it
 * made into a per-run ToolRegistry keyed by the tool_use id, so the server can
 * attach artifacts to the brief and verify that every "grounded" item names an
 * entity that really came back from Qloo.
 *
 * Tool results sent back to the model are compact JSON strings; the full data
 * stays in the registry.
 */
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaToolRunContext } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { z } from 'zod';
import {
	briefDraftSchema,
	type BriefDraft,
	type Candidate,
	type HeatmapCellLite
} from '../../brief/schema.ts';
import {
	AGE_BUCKETS_COARSE,
	AGE_BUCKETS_FINE,
	countryHintsFor,
	defaultRejectHints,
	GENDERS,
	joinIds,
	localityQueries,
	pointWkt,
	QlooClient,
	QlooError,
	QlooReplayMissError,
	resolveLocality,
	type HeatmapCell,
	type QlooEntity,
	type QlooResult,
	type ResolvedLocality
} from '../qloo/index.ts';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface RequestRecord {
	endpoint: string;
	requestKey: string;
	cacheHit: boolean;
	fetchedAt: string;
}

export type ToolArtifact =
	| { kind: 'search'; items: Candidate[] }
	| {
			kind: 'locality';
			resolution: ResolvedLocality | undefined;
			candidates: ResolvedLocality['candidates'];
	  }
	| { kind: 'artists'; purpose: 'similar' | 'city'; items: Candidate[] }
	| { kind: 'brands'; items: Candidate[] }
	| { kind: 'places'; category: string; items: Candidate[] }
	| { kind: 'heatmap'; cells: HeatmapCellLite[]; hasDimensions: boolean }
	| { kind: 'neighbourhoods'; items: Array<{ entityId: string; name: string; affinity: number }> }
	| { kind: 'demographics'; age: Record<string, number>; gender: Record<string, number> }
	| {
			kind: 'trending';
			points: Array<{
				date: string;
				percentile: number | null;
				rank: number | null;
				velocity: number | null;
			}>;
	  }
	| {
			kind: 'tags';
			purpose: 'artist' | 'city';
			items: Array<{ id: string; name: string; affinity?: number }>;
	  }
	| {
			kind: 'compare';
			shared: Array<{ id: string; name: string; score?: number }>;
			onlyA: Array<{ id: string; name: string }>;
			onlyB: Array<{ id: string; name: string }>;
	  }
	| { kind: 'brief'; draft: BriefDraft };

export interface ToolCallRecord {
	toolCallId: string;
	tool: string;
	input: unknown;
	startedAt: string;
	finishedAt?: string;
	durationMs?: number;
	ok: boolean;
	summary: string;
	requests: RequestRecord[];
	artifacts: ToolArtifact[];
	/** Entity ids Qloo returned in this call; the basis of "grounded" verification. */
	entityIds: string[];
}

export interface ToolRegistryEvents {
	onStarted?: (record: ToolCallRecord) => void;
	onFinished?: (record: ToolCallRecord) => void;
}

export class ToolBudgetExceeded extends Error {
	constructor(limit: number) {
		super(`Tool call budget of ${limit} exhausted`);
		this.name = 'ToolBudgetExceeded';
	}
}

export class ToolRegistry {
	readonly calls = new Map<string, ToolCallRecord>();
	draft: BriefDraft | undefined;
	draftToolCallId: string | undefined;
	emitBriefCalls = 0;
	private counter = 0;

	constructor(
		private readonly maxToolCalls: number,
		private readonly events: ToolRegistryEvents = {}
	) {}

	get count(): number {
		return this.counter;
	}

	get remaining(): number {
		return Math.max(0, this.maxToolCalls - this.counter);
	}

	begin(ctx: BetaToolRunContext | undefined, tool: string, input: unknown): ToolCallRecord {
		this.counter++;
		const toolCallId = ctx?.toolUse.id ?? `local_${this.counter.toString(36)}`;
		const record: ToolCallRecord = {
			toolCallId,
			tool,
			input,
			startedAt: new Date().toISOString(),
			ok: false,
			summary: '',
			requests: [],
			artifacts: [],
			entityIds: []
		};
		this.calls.set(toolCallId, record);
		this.events.onStarted?.(record);
		if (this.counter > this.maxToolCalls) {
			const err = new ToolBudgetExceeded(this.maxToolCalls);
			this.finish(record, false, err.message);
			throw err;
		}
		return record;
	}

	finish(record: ToolCallRecord, ok: boolean, summary: string): void {
		record.ok = ok;
		record.summary = summary;
		record.finishedAt = new Date().toISOString();
		record.durationMs =
			new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
		this.events.onFinished?.(record);
	}

	/** Tool call ids whose Qloo results included this entity id. */
	toolCallsReturning(entityId: string): string[] {
		const out: string[] = [];
		for (const rec of this.calls.values())
			if (rec.entityIds.includes(entityId)) out.push(rec.toolCallId);
		return out;
	}

	totals(): { toolCalls: number; qlooCalls: number; qlooCacheHits: number } {
		let qlooCalls = 0;
		let qlooCacheHits = 0;
		for (const rec of this.calls.values()) {
			qlooCalls += rec.requests.length;
			qlooCacheHits += rec.requests.filter((r) => r.cacheHit).length;
		}
		return { toolCalls: this.calls.size, qlooCalls, qlooCacheHits };
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLACE_CATEGORY_TAGS = {
	bar: 'urn:tag:genre:place:restaurant:bar',
	restaurant: 'urn:tag:genre:place:restaurant',
	hotel: 'urn:tag:genre:place:hotel',
	night_club: 'urn:tag:category:place:night_club',
	concert_hall: 'urn:tag:category:place:concert_hall',
	stadium: 'urn:tag:category:place:stadium',
	event_venue: 'urn:tag:category:place:event_venue',
	live_music_venue: 'urn:tag:genre:place:live_music_venue',
	performing_arts_theater: 'urn:tag:category:place:performing_arts_theater',
	arena: 'urn:tag:category:place:arena'
} as const;
export type PlaceCategory = keyof typeof PLACE_CATEGORY_TAGS | 'any';
const PLACE_CATEGORIES = [
	...(Object.keys(PLACE_CATEGORY_TAGS) as Array<keyof typeof PLACE_CATEGORY_TAGS>),
	'any'
] as const;

const round = (n: number | null | undefined, digits = 3): number | undefined =>
	typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(digits)) : undefined;

function tagNames(entity: QlooEntity, limit: number): string[] | undefined {
	const names = (entity.tags ?? [])
		.map((t) => t.name)
		.filter((n): n is string => typeof n === 'string');
	return names.length ? names.slice(0, limit) : undefined;
}

function stringArray(value: unknown, limit = 5): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out = value.filter((v): v is string => typeof v === 'string').slice(0, limit);
	return out.length ? out : undefined;
}

function toCandidate(entity: QlooEntity): Candidate {
	const props = (entity.properties ?? {}) as Record<string, unknown>;
	const explainability = entity.query?.explainability
		? Object.fromEntries(
				Object.entries(entity.query.explainability).map(([signal, rows]) => [
					signal,
					rows.map((r) => ({ entityId: r.entity_id, score: r.score }))
				])
			)
		: undefined;
	const image = (props.image as { url?: unknown } | undefined)?.url;
	return {
		entityId: entity.entity_id,
		name: entity.name,
		affinity: round(entity.query?.affinity),
		popularity: round(entity.popularity, 3) ?? null,
		subtype: entity.subtype,
		tags: tagNames(entity, 12),
		explainability,
		lat: entity.location?.lat,
		lon: entity.location?.lon,
		address: typeof props.address === 'string' ? props.address : undefined,
		priceLevel: typeof props.price_level === 'number' ? props.price_level : null,
		rating: typeof props.business_rating === 'number' ? props.business_rating : null,
		image: typeof image === 'string' ? image : undefined
	};
}

/** What the model sees for a candidate: enough to reason, little enough to stay cheap. */
function compactArtist(entity: QlooEntity, c: Candidate) {
	const props = (entity.properties ?? {}) as Record<string, unknown>;
	return {
		id: c.entityId,
		name: c.name,
		affinity: c.affinity,
		popularity: c.popularity,
		genres: stringArray(props.primary_genres, 3),
		origin: typeof props.place_of_birth === 'string' ? props.place_of_birth : undefined,
		explain: explainSummary(c)
	};
}

function compactBrand(entity: QlooEntity, c: Candidate) {
	const props = (entity.properties ?? {}) as Record<string, unknown>;
	return {
		id: c.entityId,
		name: c.name,
		affinity: c.affinity,
		popularity: c.popularity,
		industries: stringArray(props.industries, 3),
		targetAgeGroup: stringArray(props.target_age_group, 3),
		keyMarkets: stringArray(props.key_markets, 4),
		culturalRelevance: stringArray(props.cultural_relevance, 3),
		knownPartnerships: stringArray(props.known_partnerships, 3),
		explain: explainSummary(c)
	};
}

function compactPlace(entity: QlooEntity, c: Candidate) {
	const props = (entity.properties ?? {}) as Record<string, unknown>;
	return {
		id: c.entityId,
		name: c.name,
		affinity: c.affinity,
		popularity: c.popularity,
		address: c.address,
		lat: c.lat,
		lon: c.lon,
		distanceKm: round(entity.query?.distance, 1),
		priceLevel: c.priceLevel ?? undefined,
		rating: c.rating ?? undefined,
		kinds: tagNames(entity, 4),
		liveMusic: props.live_music === true ? true : undefined,
		eventSpaces: props.event_spaces === true ? true : undefined
	};
}

function explainSummary(c: Candidate): Record<string, number> | undefined {
	if (!c.explainability) return undefined;
	const out: Record<string, number> = {};
	for (const rows of Object.values(c.explainability))
		for (const r of rows) out[r.entityId] = round(r.score, 2) ?? 0;
	return Object.keys(out).length ? out : undefined;
}

function requestRecord<T>(res: QlooResult<T>): RequestRecord {
	return {
		endpoint: res.request.endpoint,
		requestKey: res.request.key,
		cacheHit: res.cacheHit,
		fetchedAt: res.fetchedAt
	};
}

function cellLite(cell: HeatmapCell): HeatmapCellLite {
	const q = cell.query;
	return {
		geohash: cell.location.geohash,
		lat: cell.location.latitude,
		lon: cell.location.longitude,
		affinity: q.affinity ?? 0,
		popularity: q.popularity ?? null,
		quality: q.quality_affinity ?? null,
		priceLevel: q.price_level_affinity ?? null
	};
}

function quantile(sorted: number[], p: number): number | undefined {
	if (sorted.length === 0) return undefined;
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
	return Number(sorted[idx].toFixed(3));
}

function errorPayload(err: unknown): string {
	if (err instanceof ToolBudgetExceeded) {
		return JSON.stringify({
			error: err.message,
			action: 'Stop calling tools and call emit_brief now with what you have.'
		});
	}
	if (err instanceof QlooReplayMissError) {
		return JSON.stringify({
			error: 'No cached Qloo data for this request (offline replay mode).',
			no_coverage: true
		});
	}
	if (err instanceof QlooError) {
		return JSON.stringify({ error: err.message, status: err.status });
	}
	return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

function locationFilter(input: {
	locality_id?: string;
	lat?: number;
	lon?: number;
	radius_m?: number;
}) {
	if (input.locality_id) return { 'filter.location': input.locality_id };
	if (typeof input.lat === 'number' && typeof input.lon === 'number') {
		return {
			'filter.location': pointWkt(input.lat, input.lon),
			'filter.location.radius': input.radius_m ?? 15000
		};
	}
	throw new Error('Provide locality_id (preferred) or lat and lon.');
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export interface ToolFactoryOptions {
	client: QlooClient;
	registry: ToolRegistry;
	/** Injectable clock for deterministic trending windows in tests. */
	now?: () => Date;
}

const ids = z.array(z.string().min(8)).min(1).max(5).describe('Qloo entity ids');
const localityId = z
	.string()
	.optional()
	.describe('Qloo locality entity id from qloo_resolve_locality; use it whenever you have one');
const take = (def: number, max: number) => z.number().int().min(1).max(max).default(def);

/** Build the Qloo-backed tools plus emit_brief for one run. */
export function createAgentTools({ client, registry, now = () => new Date() }: ToolFactoryOptions) {
	const searchEntity = betaZodTool({
		name: 'qloo_search_entity',
		description:
			'Resolve a name to Qloo entity candidates. Always call this before using an artist, brand or place by name. Returns up to 5 candidates with ids, popularity (0-1 percentile) and a disambiguation string. Pick the candidate that matches the user intent; never guess an id.',
		inputSchema: z.object({
			name: z.string().min(1),
			type: z.enum(['artist', 'brand', 'place', 'person', 'destination']).default('artist')
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_search_entity', input);
			try {
				const res = await client.search(input.name, `urn:entity:${input.type}` as const, {
					take: 5
				});
				rec.requests.push(requestRecord(res));
				const items = res.data.results.map((r) => ({
					id: r.entity_id,
					name: r.name,
					types: r.types,
					popularity: round(r.popularity, 3),
					disambiguation: r.disambiguation ?? undefined
				}));
				rec.entityIds = items.map((i) => i.id);
				rec.artifacts.push({
					kind: 'search',
					items: items.map((i) => ({
						entityId: i.id,
						name: i.name,
						popularity: i.popularity ?? null
					}))
				});
				registry.finish(
					rec,
					true,
					`${items.length} candidates for "${input.name}"${res.cacheHit ? ' (cache)' : ''}`
				);
				return JSON.stringify({
					count: items.length,
					candidates: items,
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const resolveLocalityTool = betaZodTool({
		name: 'qloo_resolve_locality',
		description:
			'Resolve a city to a Qloo locality entity id with a country check (free-text city names are unreliable: "Panama City" resolves to Florida). Returns the accepted locality with coordinates, or null plus the candidates seen. Use the returned locality id in every other tool. If it returns null, fall back to lat/lon in the other tools and say so in the brief.',
		inputSchema: z.object({
			city: z.string().min(1),
			country: z.string().min(2).describe('ISO 3166-1 alpha-2 code preferred, e.g. GT, PA, MX, US')
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_resolve_locality', input);
			try {
				const criteria = {
					cityName: input.city,
					countryHints: countryHintsFor(input.country),
					rejectHints: defaultRejectHints(input.country)
				};
				const queries = localityQueries(input.city, input.country);
				const resolution = await resolveLocality(
					{
						search: async (
							query: string,
							type: 'urn:entity:locality',
							opts?: { take?: number }
						) => {
							const res = await client.search(query, type, opts);
							rec.requests.push(requestRecord(res));
							return res;
						}
					} as unknown as QlooClient,
					queries,
					criteria
				);
				const candidates = resolution?.candidates ?? [];
				rec.artifacts.push({ kind: 'locality', resolution, candidates });
				if (resolution) rec.entityIds = [resolution.entityId];
				registry.finish(
					rec,
					true,
					resolution
						? `locality ${resolution.name} (${resolution.disambiguation ?? resolution.entityId})`
						: 'locality unresolved'
				);
				return JSON.stringify({
					resolved: resolution
						? {
								id: resolution.entityId,
								name: resolution.name,
								disambiguation: resolution.disambiguation,
								lat: resolution.lat,
								lon: resolution.lon,
								query: resolution.query
							}
						: null,
					candidates: candidates.slice(0, 8).map((c) => ({
						id: c.entityId,
						name: c.name,
						disambiguation: c.disambiguation,
						acceptable: c.acceptable
					})),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const similarArtists = betaZodTool({
		name: 'qloo_similar_artists',
		description:
			'Artists whose audiences overlap with the given artist(s), ranked by Qloo affinity, with per-signal explainability. Pass locality_id to bias toward the city audience (then the explainability shows how much the city vs. the artist drove each result). Use for openers and co-headliners.',
		inputSchema: z.object({
			artist_ids: ids,
			locality_id: localityId,
			exclude_ids: z
				.array(z.string())
				.max(10)
				.optional()
				.describe('entity ids to exclude, e.g. the headliner'),
			take: take(10, 25)
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_similar_artists', input);
			try {
				const res = await client.insights('urn:entity:artist', {
					'signal.interests.entities': joinIds(input.artist_ids),
					'signal.location': input.locality_id,
					'filter.exclude.entities': input.exclude_ids?.length
						? joinIds(input.exclude_ids)
						: undefined,
					'feature.explainability': true,
					take: input.take
				});
				rec.requests.push(requestRecord(res));
				const entities = res.data.results.entities;
				const items = entities.map(toCandidate);
				rec.entityIds = items.map((i) => i.entityId);
				rec.artifacts.push({ kind: 'artists', purpose: 'similar', items });
				registry.finish(
					rec,
					true,
					`${items.length} similar artists${res.cacheHit ? ' (cache)' : ''}`
				);
				return JSON.stringify({
					count: items.length,
					artists: entities.map((e, i) => compactArtist(e, items[i])),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const brandAffinities = betaZodTool({
		name: 'qloo_brand_affinities',
		description:
			'Brands with cross-domain affinity to the artist audience, ranked, with explainability. Pass locality_id so the ranking reflects the city (verified: location changes brand rankings substantially). Optional age/gender narrow the audience. Use for sponsor candidates.',
		inputSchema: z.object({
			artist_ids: ids,
			locality_id: localityId,
			age: z.enum([...AGE_BUCKETS_FINE, ...AGE_BUCKETS_COARSE]).optional(),
			gender: z.enum(GENDERS).optional(),
			take: take(15, 30)
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_brand_affinities', input);
			try {
				const res = await client.insights('urn:entity:brand', {
					'signal.interests.entities': joinIds(input.artist_ids),
					'signal.location': input.locality_id,
					'signal.demographics.age': input.age,
					'signal.demographics.gender': input.gender,
					'feature.explainability': true,
					take: input.take
				});
				rec.requests.push(requestRecord(res));
				const entities = res.data.results.entities;
				const items = entities.map(toCandidate);
				rec.entityIds = items.map((i) => i.entityId);
				rec.artifacts.push({ kind: 'brands', items });
				registry.finish(rec, true, `${items.length} brands${res.cacheHit ? ' (cache)' : ''}`);
				return JSON.stringify({
					count: items.length,
					brands: entities.map((e, i) => compactBrand(e, items[i])),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const placesNear = betaZodTool({
		name: 'qloo_places_near',
		description:
			'Places in the city with affinity to the artist audience: venues (concert_hall, stadium, arena, event_venue, live_music_venue, performing_arts_theater), partners (bar, restaurant, hotel, night_club) or any. Location: locality_id (preferred) or lat/lon + radius_m. Optional price level 1-4 filters. Venue inventory is thin outside large markets: fewer than 3 venues means no coverage, say so and use the promoter venues instead.',
		inputSchema: z.object({
			artist_ids: ids,
			locality_id: localityId,
			lat: z.number().optional(),
			lon: z.number().optional(),
			radius_m: z.number().int().min(500).max(60000).optional(),
			category: z.enum(PLACE_CATEGORIES).default('any'),
			price_level_min: z.number().int().min(1).max(4).optional(),
			price_level_max: z.number().int().min(1).max(4).optional(),
			take: take(15, 50)
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_places_near', input);
			try {
				const tag = input.category === 'any' ? undefined : PLACE_CATEGORY_TAGS[input.category];
				const res = await client.insights('urn:entity:place', {
					...locationFilter(input),
					'signal.interests.entities': joinIds(input.artist_ids),
					'filter.tags': tag,
					'filter.price_level.min': input.price_level_min,
					'filter.price_level.max': input.price_level_max,
					'feature.explainability': true,
					take: input.take
				});
				rec.requests.push(requestRecord(res));
				const entities = res.data.results.entities;
				const items = entities.map(toCandidate);
				rec.entityIds = items.map((i) => i.entityId);
				rec.artifacts.push({ kind: 'places', category: input.category, items });
				registry.finish(
					rec,
					true,
					`${items.length} places (${input.category})${res.cacheHit ? ' (cache)' : ''}`
				);
				return JSON.stringify({
					count: items.length,
					category: input.category,
					no_coverage: items.length === 0,
					places: entities.map((e, i) => compactPlace(e, items[i])),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const heatmap = betaZodTool({
		name: 'qloo_heatmap',
		description:
			'Where the artist audience concentrates inside the city: geohash cells with affinity, popularity and (with_dimensions) quality and price-level affinity. Returns a summary: cell count, top hotspots, and the price-level affinity distribution used for pricing guidance. The full cell set is attached to the brief automatically; do not re-list cells.',
		inputSchema: z.object({
			artist_ids: ids,
			locality_id: localityId,
			lat: z.number().optional(),
			lon: z.number().optional(),
			radius_m: z.number().int().min(1000).max(60000).optional(),
			with_dimensions: z.boolean().default(true)
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_heatmap', input);
			try {
				const res = await client.heatmap({
					...locationFilter({ ...input, radius_m: input.radius_m ?? 25000 }),
					'signal.interests.entities': joinIds(input.artist_ids),
					'heatmap.dimensions': input.with_dimensions ? 'quality,popularity,price_level' : undefined
				});
				rec.requests.push(requestRecord(res));
				const cells = res.data.results.heatmap.map(cellLite);
				const hasDimensions = cells.some(
					(c) => c.priceLevel !== null && c.priceLevel !== undefined
				);
				rec.artifacts.push({ kind: 'heatmap', cells, hasDimensions });
				const top = [...cells].sort((a, b) => b.affinity - a.affinity).slice(0, 10);
				const priceVals = cells
					.map((c) => c.priceLevel)
					.filter((v): v is number => typeof v === 'number')
					.sort((a, b) => a - b);
				const affinities = cells.map((c) => c.affinity).sort((a, b) => a - b);
				registry.finish(
					rec,
					true,
					`${cells.length} heatmap cells${hasDimensions ? ' with dimensions' : ''}${res.cacheHit ? ' (cache)' : ''}`
				);
				return JSON.stringify({
					cellCount: cells.length,
					no_coverage: cells.length === 0,
					hasDimensions,
					hotspots: top.map((c) => ({
						geohash: c.geohash,
						lat: c.lat,
						lon: c.lon,
						affinity: round(c.affinity, 3),
						priceLevelAffinity: round(c.priceLevel, 3)
					})),
					affinity: {
						p50: quantile(affinities, 0.5),
						p90: quantile(affinities, 0.9),
						max: quantile(affinities, 1)
					},
					priceLevelAffinity: hasDimensions
						? {
								cellsWithValue: priceVals.length,
								p25: quantile(priceVals, 0.25),
								p50: quantile(priceVals, 0.5),
								p75: quantile(priceVals, 0.75),
								p90: quantile(priceVals, 0.9)
							}
						: null,
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const neighbourhoods = betaZodTool({
		name: 'qloo_heatmap_neighbourhoods',
		description:
			'The same audience heatmap aggregated by named localities (neighbourhoods, districts) instead of cells: name and affinity, top 15. Good for naming where the audience lives.',
		inputSchema: z.object({
			artist_ids: ids,
			locality_id: localityId,
			lat: z.number().optional(),
			lon: z.number().optional(),
			radius_m: z.number().int().min(1000).max(60000).optional()
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_heatmap_neighbourhoods', input);
			try {
				const res = await client.heatmapByLocality({
					...locationFilter({ ...input, radius_m: input.radius_m ?? 25000 }),
					'signal.interests.entities': joinIds(input.artist_ids)
				});
				rec.requests.push(requestRecord(res));
				const items = res.data.results.entities
					.map((e) => ({ entityId: e.entity_id, name: e.name, affinity: e.query.affinity }))
					.sort((a, b) => b.affinity - a.affinity)
					.slice(0, 15);
				rec.entityIds = items.map((i) => i.entityId);
				rec.artifacts.push({ kind: 'neighbourhoods', items });
				registry.finish(
					rec,
					true,
					`${items.length} neighbourhoods${res.cacheHit ? ' (cache)' : ''}`
				);
				return JSON.stringify({
					count: items.length,
					neighbourhoods: items.map((i) => ({
						id: i.entityId,
						name: i.name,
						affinity: round(i.affinity, 3)
					})),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const demographics = betaZodTool({
		name: 'qloo_audience_demographics',
		description:
			'Age and gender affinity of the artist audience (Qloo demographics). Values are affinity scores relative to the general population: positive means over-indexed, negative under-indexed; they are not audience shares. Buckets: 24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older; male, female.',
		inputSchema: z.object({ artist_ids: ids }),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_audience_demographics', input);
			try {
				const res = await client.demographics({
					'signal.interests.entities': joinIds(input.artist_ids)
				});
				rec.requests.push(requestRecord(res));
				const first = res.data.results.demographics[0];
				if (!first) {
					registry.finish(rec, true, 'no demographics');
					return JSON.stringify({ no_coverage: true, toolCallId: rec.toolCallId });
				}
				rec.artifacts.push({
					kind: 'demographics',
					age: first.query.age,
					gender: first.query.gender
				});
				const topAges = Object.entries(first.query.age)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 2)
					.map(([bucket]) => bucket);
				const male = first.query.gender.male ?? 0;
				const female = first.query.gender.female ?? 0;
				const skew =
					Math.abs(male - female) < 0.05 ? 'balanced' : male > female ? 'male' : 'female';
				registry.finish(
					rec,
					true,
					`demographics: top ages ${topAges.join(', ')}, ${skew}${res.cacheHit ? ' (cache)' : ''}`
				);
				return JSON.stringify({
					age: first.query.age,
					gender: first.query.gender,
					topAgeBuckets: topAges,
					genderSkew: skew,
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const trending = betaZodTool({
		name: 'qloo_trending',
		description:
			'Popularity trend series for one artist over the trailing months (population percentile, rank and velocity by day). The series lags the present by some months; the summary reports the latest available point and the direction over the window. Empty means no coverage.',
		inputSchema: z.object({
			artist_id: z.string().min(8),
			months: z.number().int().min(1).max(24).default(12)
		}),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_trending', input);
			try {
				const end = now();
				const start = new Date(end);
				start.setUTCMonth(start.getUTCMonth() - input.months);
				const fmt = (d: Date) => d.toISOString().slice(0, 10);
				const res = await client.trending({
					'signal.interests.entities': input.artist_id,
					'filter.type': 'urn:entity:artist',
					'filter.start_date': fmt(start),
					'filter.end_date': fmt(end),
					take: 50
				});
				rec.requests.push(requestRecord(res));
				const points = res.data.results.trending
					.map((p) => ({
						date: p.date,
						percentile: p.population_percentile ?? null,
						rank:
							p.population_rank === null || p.population_rank === undefined
								? null
								: Number(p.population_rank),
						velocity: p.population_rank_velocity ?? null
					}))
					.sort((a, b) => a.date.localeCompare(b.date));
				rec.artifacts.push({ kind: 'trending', points });
				if (points.length === 0) {
					registry.finish(rec, true, 'no trending data');
					return JSON.stringify({
						no_coverage: true,
						window: { start: fmt(start), end: fmt(end) },
						toolCallId: rec.toolCallId
					});
				}
				const first = points[0];
				const last = points[points.length - 1];
				const delta = (last.percentile ?? 0) - (first.percentile ?? 0);
				const direction = delta > 0.02 ? 'rising' : delta < -0.02 ? 'falling' : 'flat';
				registry.finish(
					rec,
					true,
					`${points.length} trend points, ${direction}${res.cacheHit ? ' (cache)' : ''}`
				);
				return JSON.stringify({
					points: points.length,
					window: { start: fmt(start), end: fmt(end) },
					first: { date: first.date, percentile: round(first.percentile, 3), rank: first.rank },
					latest: {
						date: last.date,
						percentile: round(last.percentile, 3),
						rank: last.rank,
						velocity: round(last.velocity, 3)
					},
					percentileDelta: round(delta, 3),
					direction,
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const compare = betaZodTool({
		name: 'qloo_compare',
		description:
			'Taste overlap between two artists as shared tags with a score, plus tags unique to each. Use to judge co-headliner fit or how a candidate differs from the headliner.',
		inputSchema: z.object({ artist_a_id: z.string().min(8), artist_b_id: z.string().min(8) }),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_compare', input);
			try {
				const res = await client.compare({
					'a.signal.interests.entities': input.artist_a_id,
					'b.signal.interests.entities': input.artist_b_id,
					'filter.type': 'urn:tag',
					take: 20
				});
				rec.requests.push(requestRecord(res));
				const score = (t: { query?: Record<string, unknown> }) =>
					typeof t.query?.score === 'number' ? round(t.query.score as number, 3) : undefined;
				const shared = res.data.results.tags
					.slice(0, 15)
					.map((t) => ({ id: t.tag_id, name: t.name, score: score(t) }));
				const onlyA = (res.data.results.a ?? [])
					.slice(0, 8)
					.map((t) => ({ id: t.tag_id, name: t.name }));
				const onlyB = (res.data.results.b ?? [])
					.slice(0, 8)
					.map((t) => ({ id: t.tag_id, name: t.name }));
				rec.artifacts.push({ kind: 'compare', shared, onlyA, onlyB });
				registry.finish(rec, true, `${shared.length} shared tags${res.cacheHit ? ' (cache)' : ''}`);
				return JSON.stringify({
					shared,
					onlyA: onlyA.map((t) => t.name),
					onlyB: onlyB.map((t) => t.name),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const cityTaste = betaZodTool({
		name: 'qloo_city_taste',
		description:
			'The city taste profile with the locality as the only signal: top music tags and top artists with affinity to the city. Compare with qloo_artist_tags to judge how the artist fits the local taste.',
		inputSchema: z.object({ locality_id: z.string().min(8), take: take(20, 30) }),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_city_taste', input);
			try {
				const [tagsRes, artistsRes] = await Promise.all([
					client.tagInsights({
						'signal.location': input.locality_id,
						'filter.parents.types': 'urn:entity:artist',
						take: input.take
					}),
					client.insights('urn:entity:artist', {
						'signal.location': input.locality_id,
						take: input.take
					})
				]);
				rec.requests.push(requestRecord(tagsRes), requestRecord(artistsRes));
				const tags = tagsRes.data.results.tags.map((t) => ({
					id: t.tag_id,
					name: t.name,
					affinity: round(t.query?.affinity, 3)
				}));
				const entities = artistsRes.data.results.entities;
				const artists = entities.map(toCandidate);
				rec.entityIds = artists.map((a) => a.entityId);
				rec.artifacts.push(
					{ kind: 'tags', purpose: 'city', items: tags },
					{ kind: 'artists', purpose: 'city', items: artists }
				);
				registry.finish(rec, true, `${tags.length} city tags, ${artists.length} city artists`);
				return JSON.stringify({
					tags: tags.map((t) => t.name),
					artists: entities
						.map((e, i) => compactArtist(e, artists[i]))
						.map((a) => ({ ...a, explain: undefined })),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const artistTags = betaZodTool({
		name: 'qloo_artist_tags',
		description:
			'The artist taste profile as Qloo tags (genres, themes, styles) with affinity. Pair with qloo_city_taste for the taste match.',
		inputSchema: z.object({ artist_ids: ids, take: take(20, 30) }),
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'qloo_artist_tags', input);
			try {
				const res = await client.tagInsights({
					'signal.interests.entities': joinIds(input.artist_ids),
					take: input.take
				});
				rec.requests.push(requestRecord(res));
				const tags = res.data.results.tags.map((t) => ({
					id: t.tag_id,
					name: t.name,
					affinity: round(t.query?.affinity, 3)
				}));
				rec.artifacts.push({ kind: 'tags', purpose: 'artist', items: tags });
				registry.finish(rec, true, `${tags.length} artist tags${res.cacheHit ? ' (cache)' : ''}`);
				return JSON.stringify({
					tags: tags.map((t) => ({ name: t.name, affinity: t.affinity })),
					toolCallId: rec.toolCallId
				});
			} catch (err) {
				registry.finish(rec, false, errorMessage(err));
				return errorPayload(err);
			}
		}
	});

	const emitBrief = betaZodTool({
		name: 'emit_brief',
		description:
			'Deliver the finished Booking Brief as a structured object. Call exactly once, at the end, after the research tools. Every pick must name an entity id returned by a tool in this run and cite the tool call ids in `sources`. Label each section and item grounded, inferred or no_coverage. The server attaches the raw heatmap, demographics and candidate lists itself. Keep texts short so the input validates: section summaries under 150 words, each `why` under 80 words, outreach bodies under 250 words, at most 6 key points, 12 shared tags and 3 age buckets; never exceed the array sizes in the schema.',
		inputSchema: briefDraftSchema,
		eager_input_streaming: true,
		run: async (input, ctx) => {
			const rec = registry.begin(ctx, 'emit_brief', { headline: input.headline });
			registry.emitBriefCalls++;
			if (registry.draft) {
				registry.finish(rec, false, 'emit_brief called more than once');
				return JSON.stringify({ error: 'The brief was already emitted. Stop.' });
			}
			registry.draft = input;
			registry.draftToolCallId = rec.toolCallId;
			rec.artifacts.push({ kind: 'brief', draft: input });
			registry.finish(rec, true, `brief emitted: ${input.verdict}`);
			return JSON.stringify({
				ok: true,
				message: 'Brief accepted. Reply with one short closing sentence and stop.'
			});
		}
	});

	// Deterministic order: the tool list is part of the cached prompt prefix.
	const tools = [
		searchEntity,
		resolveLocalityTool,
		similarArtists,
		brandAffinities,
		placesNear,
		heatmap,
		neighbourhoods,
		demographics,
		trending,
		compare,
		cityTaste,
		artistTags,
		emitBrief
	];
	// registry.begin() throws ToolBudgetExceeded before a tool's own try/catch; turn that into the
	// instruction payload so the model is told to call emit_brief instead of seeing a bare error.
	return tools.map((tool) => ({
		...tool,
		run: async (input: unknown, ctx?: BetaToolRunContext) => {
			try {
				return await (tool.run as (i: unknown, c?: BetaToolRunContext) => Promise<string>)(
					input,
					ctx
				);
			} catch (err) {
				if (err instanceof ToolBudgetExceeded) return errorPayload(err);
				throw err;
			}
		}
	}));
}

export type AgentTools = ReturnType<typeof createAgentTools>;
export const QLOO_TOOL_NAMES = [
	'qloo_search_entity',
	'qloo_resolve_locality',
	'qloo_similar_artists',
	'qloo_brand_affinities',
	'qloo_places_near',
	'qloo_heatmap',
	'qloo_heatmap_neighbourhoods',
	'qloo_audience_demographics',
	'qloo_trending',
	'qloo_compare',
	'qloo_city_taste',
	'qloo_artist_tags'
] as const;
