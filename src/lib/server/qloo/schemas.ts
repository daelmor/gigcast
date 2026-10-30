/**
 * Zod schemas for Qloo API responses, derived from the recorded samples in
 * docs/qloo-samples (M0 probe). Every object schema is `.loose()` so fields
 * Qloo adds later survive parsing; only the fields the product relies on are
 * typed.
 */
import { z } from 'zod';

const str = z.string();
const num = z.number();
const record = z.record(z.string(), z.unknown());

export const tagRefSchema = z
	.object({
		id: str.optional(),
		tag_id: str.optional(),
		name: str.optional(),
		type: str.optional(),
		subtype: str.optional(),
		weight: num.nullable().optional()
	})
	.loose();
export type TagRef = z.infer<typeof tagRefSchema>;

/** Per-result explainability: which input signal contributed how much. */
export const explainabilitySchema = z.record(
	z.string(),
	z.array(z.object({ entity_id: str, score: num }).loose())
);
export type Explainability = z.infer<typeof explainabilitySchema>;

export const entityQuerySchema = z
	.object({
		affinity: num.optional(),
		affinity_rank: num.optional(),
		distance: num.optional(),
		measurements: record.optional(),
		explainability: explainabilitySchema.optional()
	})
	.loose();

export const locationSchema = z.object({ lat: num, lon: num, geohash: str.optional() }).loose();

export const entitySchema = z
	.object({
		name: str,
		entity_id: str,
		type: str.optional(),
		subtype: str.optional(),
		popularity: num.nullable().optional(),
		tags: z.array(tagRefSchema).optional(),
		properties: record.optional(),
		disambiguation: str.nullable().optional(),
		location: locationSchema.optional(),
		external: record.nullable().optional(),
		query: entityQuerySchema.optional()
	})
	.loose();
export type QlooEntity = z.infer<typeof entitySchema>;

export const searchResultSchema = z
	.object({
		name: str,
		entity_id: str,
		types: z.array(str).optional(),
		popularity: num.nullable().optional(),
		disambiguation: str.nullable().optional(),
		properties: record.optional(),
		tags: z.array(tagRefSchema).optional(),
		location: locationSchema.optional()
	})
	.loose();
export type SearchResult = z.infer<typeof searchResultSchema>;
export const searchResponseSchema = z.object({ results: z.array(searchResultSchema) }).loose();
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const localityRefSchema = z
	.object({
		entity_id: str,
		name: str,
		subtype: str.optional(),
		location: z.object({ lat: num, lon: num }).loose().optional(),
		popularity: num.optional(),
		disambiguation: str.nullable().optional()
	})
	.loose();
export type LocalityRef = z.infer<typeof localityRefSchema>;

/** The echo block Qloo attaches to insights: how free-text locations were resolved. */
export const insightsQueryEchoSchema = z
	.object({
		localities: z
			.object({
				filter: z.array(localityRefSchema).optional(),
				signal: z.array(localityRefSchema).optional()
			})
			.loose()
			.optional()
	})
	.loose();

export const entityInsightsResponseSchema = z
	.object({
		success: z.boolean().optional(),
		results: z.object({ entities: z.array(entitySchema) }).loose(),
		query: insightsQueryEchoSchema.optional()
	})
	.loose();
export type EntityInsightsResponse = z.infer<typeof entityInsightsResponseSchema>;

/**
 * Heatmap cell. `query` always has affinity, affinity_rank and popularity;
 * with `heatmap.dimensions=quality,popularity,price_level` it also carries
 * quality_affinity, popularity_affinity, price_level_affinity,
 * price_level_total_count and their *_rank columns.
 */
export const heatmapCellSchema = z
	.object({
		location: z.object({ latitude: num, longitude: num, geohash: str }).loose(),
		query: z.record(z.string(), num.nullable())
	})
	.loose();
export type HeatmapCell = z.infer<typeof heatmapCellSchema>;
export const heatmapResponseSchema = z
	.object({
		results: z.object({ heatmap: z.array(heatmapCellSchema) }).loose(),
		query: insightsQueryEchoSchema.optional()
	})
	.loose();
export type HeatmapResponse = z.infer<typeof heatmapResponseSchema>;

/** Heatmap with output.heatmap.boundary=urn:entity:locality: localities with affinity and a WKT boundary. */
export const heatmapLocalitySchema = z
	.object({
		name: str,
		entity_id: str,
		popularity: num.nullable().optional(),
		query: z.object({ affinity: num }).loose(),
		disambiguation: str.nullable().optional(),
		boundary: str.optional()
	})
	.loose();
export const heatmapLocalityResponseSchema = z
	.object({
		results: z.object({ entities: z.array(heatmapLocalitySchema) }).loose(),
		query: insightsQueryEchoSchema.optional()
	})
	.loose();
export type HeatmapLocalityResponse = z.infer<typeof heatmapLocalityResponseSchema>;

/** Age and gender values are affinity scores (can be negative), not audience shares. */
export const demographicsResponseSchema = z
	.object({
		results: z
			.object({
				demographics: z.array(
					z
						.object({
							entity_id: str,
							query: z
								.object({
									age: z.record(z.string(), num),
									gender: z.record(z.string(), num)
								})
								.loose()
						})
						.loose()
				)
			})
			.loose()
	})
	.loose();
export type DemographicsResponse = z.infer<typeof demographicsResponseSchema>;

export const tagInsightSchema = z
	.object({
		tag_id: str,
		name: str,
		types: z.array(str).optional(),
		subtype: str.optional(),
		tag_value: str.optional(),
		popularity: num.nullable().optional(),
		query: z.object({ affinity: num.optional() }).loose().optional()
	})
	.loose();
export type TagInsight = z.infer<typeof tagInsightSchema>;
export const tagInsightsResponseSchema = z
	.object({
		results: z.object({ tags: z.array(tagInsightSchema) }).loose(),
		query: insightsQueryEchoSchema.optional()
	})
	.loose();
export type TagInsightsResponse = z.infer<typeof tagInsightsResponseSchema>;

export const tagSchema = z
	.object({
		id: str,
		name: str,
		type: str.optional(),
		parents: z.array(z.object({ type: str }).loose()).optional(),
		popularity: num.nullable().optional(),
		properties: record.optional()
	})
	.loose();
export type Tag = z.infer<typeof tagSchema>;
export const tagsResponseSchema = z
	.object({ results: z.object({ tags: z.array(tagSchema) }).loose() })
	.loose();
export type TagsResponse = z.infer<typeof tagsResponseSchema>;

export const trendingPointSchema = z
	.object({
		date: str,
		population_percentile: num.nullable().optional(),
		population_rank: z.union([str, num]).nullable().optional(),
		population_rank_velocity: num.nullable().optional(),
		velocity_fold_change: num.nullable().optional(),
		population_percent_delta: num.nullable().optional()
	})
	.loose();
export type TrendingPoint = z.infer<typeof trendingPointSchema>;
export const trendingResponseSchema = z
	.object({ results: z.object({ trending: z.array(trendingPointSchema) }).loose() })
	.loose();
export type TrendingResponse = z.infer<typeof trendingResponseSchema>;

export const compareTagSchema = z
	.object({
		tag_id: str,
		name: str,
		type: str.optional(),
		subtype: str.optional(),
		entity_id: str.optional(),
		popularity: num.nullable().optional(),
		query: record.optional()
	})
	.loose();
export type CompareTag = z.infer<typeof compareTagSchema>;
export const compareResponseSchema = z
	.object({
		results: z
			.object({
				tags: z.array(compareTagSchema),
				a: z.array(compareTagSchema).optional(),
				b: z.array(compareTagSchema).optional(),
				matchEntities: z.array(z.unknown()).optional()
			})
			.loose()
	})
	.loose();
export type CompareResponse = z.infer<typeof compareResponseSchema>;

export const entityDetailSchema = z
	.object({
		name: str,
		entity_id: str,
		types: z.array(str).optional(),
		properties: record.optional(),
		popularity: num.nullable().optional(),
		tags: z
			.array(
				z
					.object({
						name: str,
						tag_id: str.optional(),
						type: str.optional(),
						value: str.optional()
					})
					.loose()
			)
			.optional(),
		disambiguation: str.nullable().optional()
	})
	.loose();
export type EntityDetail = z.infer<typeof entityDetailSchema>;
export const entitiesResponseSchema = z.object({ results: z.array(entityDetailSchema) }).loose();
export type EntitiesResponse = z.infer<typeof entitiesResponseSchema>;

export const audienceTypesResponseSchema = z
	.object({
		results: z
			.object({
				audience_types: z.array(
					z
						.object({ type: str, parents: z.array(z.object({ type: str }).loose()).optional() })
						.loose()
				)
			})
			.loose()
	})
	.loose();
export const audiencesResponseSchema = z
	.object({
		results: z
			.object({
				audiences: z.array(
					z
						.object({
							id: str,
							entity_id: str.optional(),
							name: str,
							type: str.optional(),
							disambiguation: str.nullable().optional()
						})
						.loose()
				)
			})
			.loose()
	})
	.loose();

/** Observed error bodies: v2 400s, 401 on the wrong base URL, 404 on unknown paths. */
const errorsListSchema = z
	.object({ errors: z.array(z.object({ message: str, path: str.optional() }).loose()) })
	.loose();
const errorObjectSchema = z
	.object({
		error: z
			.object({ reason: str.optional(), message: str.optional(), code: num.optional() })
			.loose()
	})
	.loose();
const messageSchema = z.object({ message: str }).loose();
export const errorBodySchema = z.union([errorsListSchema, errorObjectSchema, messageSchema]);

/** Best-effort human message from any error body shape; undefined when none is recognizable. */
export function extractErrorMessage(body: unknown): string | undefined {
	if (typeof body === 'string') return body.slice(0, 300) || undefined;
	const list = errorsListSchema.safeParse(body);
	if (list.success) return list.data.errors.map((e) => e.message).join('; ');
	const obj = errorObjectSchema.safeParse(body);
	if (obj.success) return obj.data.error.message ?? obj.data.error.reason;
	const msg = messageSchema.safeParse(body);
	return msg.success ? msg.data.message : undefined;
}

/** Tag identifier regardless of which key the endpoint used. */
export function tagId(tag: TagRef | Tag | TagInsight | CompareTag): string | undefined {
	return 'id' in tag && typeof tag.id === 'string'
		? tag.id
		: 'tag_id' in tag && typeof tag.tag_id === 'string'
			? tag.tag_id
			: undefined;
}
