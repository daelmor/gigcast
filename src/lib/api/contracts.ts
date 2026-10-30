/**
 * Request and response contracts for the JSON API, shared by the server
 * routes and the browser code. Zod at the boundary on both sides.
 */
import { z } from 'zod';
import { agentEventSchema } from '../brief/events.ts';
import {
	briefInputSchema,
	briefSchema,
	marketCalendarSchema,
	riskFeedSchema
} from '../brief/schema.ts';

export const briefStatusSchema = z.enum(['queued', 'running', 'complete', 'partial', 'failed']);
export type BriefStatus = z.infer<typeof briefStatusSchema>;

// POST /api/briefs --------------------------------------------------------

export const createBriefRequestSchema = briefInputSchema.extend({
	/** Slug from KNOWN_MARKETS when the promoter used a quick pick. */
	marketId: z.string().min(1).optional()
});
export type CreateBriefRequest = z.infer<typeof createBriefRequestSchema>;

export const createBriefResponseSchema = z.object({ id: z.string(), status: briefStatusSchema });
export type CreateBriefResponse = z.infer<typeof createBriefResponseSchema>;

// GET /api/briefs/:id -----------------------------------------------------

export const runRecordSchema = z.object({
	id: z.string(),
	kind: z.enum(['main', 'counterfactual']),
	model: z.string(),
	status: z.string(),
	startedAt: z.string(),
	finishedAt: z.string().nullable(),
	inputTokens: z.number().int(),
	outputTokens: z.number().int(),
	cacheReadInputTokens: z.number().int(),
	cacheCreationInputTokens: z.number().int(),
	qlooCalls: z.number().int(),
	qlooCacheHits: z.number().int(),
	toolCalls: z.number().int(),
	error: z.string().nullable()
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export const briefRecordSchema = z.object({
	id: z.string(),
	status: briefStatusSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
	marketId: z.string().nullable(),
	input: briefInputSchema,
	/** Null until the run finishes. */
	brief: briefSchema.nullable(),
	markdown: z.string().nullable(),
	runs: z.array(runRecordSchema),
	/** Events of every run (main and counterfactual), in storage order. */
	events: z.array(agentEventSchema),
	/** Storage id of the last event included, 0 for none; the SSE resume point. */
	lastEventId: z.number().int().nonnegative().default(0)
});
export type BriefRecord = z.infer<typeof briefRecordSchema>;

// GET / (recent briefs) ---------------------------------------------------

export const briefListItemSchema = z.object({
	id: z.string(),
	status: briefStatusSchema,
	/** Known market slug when the brief started from a quick pick. */
	marketId: z.string().nullable().default(null),
	artistName: z.string(),
	city: z.string(),
	country: z.string(),
	localityName: z.string().nullable(),
	dateFrom: z.string().nullable(),
	dateTo: z.string().nullable(),
	headline: z.string().nullable(),
	verdict: z.enum(['promising', 'mixed', 'weak', 'insufficient_data']).nullable(),
	createdAt: z.string()
});
export type BriefListItem = z.infer<typeof briefListItemSchema>;

// GET /api/search/artists?q= ---------------------------------------------

export const artistSearchResultSchema = z.object({
	entityId: z.string(),
	name: z.string(),
	disambiguation: z.string().optional(),
	popularity: z.number().nullable().optional(),
	image: z.string().optional(),
	tags: z.array(z.string()).default([])
});
export type ArtistSearchResult = z.infer<typeof artistSearchResultSchema>;
export const artistSearchResponseSchema = z.object({
	query: z.string(),
	results: z.array(artistSearchResultSchema)
});
export type ArtistSearchResponse = z.infer<typeof artistSearchResponseSchema>;

// GET /api/search/localities?q=&country= ---------------------------------

export const localitySearchResultSchema = z.object({
	entityId: z.string(),
	name: z.string(),
	disambiguation: z.string().optional(),
	lat: z.number().optional(),
	lon: z.number().optional(),
	/** True when the disambiguation matches the requested country. */
	acceptable: z.boolean()
});
export type LocalitySearchResult = z.infer<typeof localitySearchResultSchema>;
export const localitySearchResponseSchema = z.object({
	query: z.string(),
	country: z.string(),
	results: z.array(localitySearchResultSchema)
});
export type LocalitySearchResponse = z.infer<typeof localitySearchResponseSchema>;

// GET /api/briefs/:id/events (SSE) ---------------------------------------
//
// Every message has `id: <seq>` so EventSource resumes with Last-Event-ID.
//   event: agent   data: AgentEvent (JSON)
//   event: status  data: { status: BriefStatus }
//   event: done    data: { status: BriefStatus }
// A comment line (`: ping`) is sent every 15 seconds to keep proxies alive.

export const sseStatusDataSchema = z.object({ status: briefStatusSchema });
export type SseStatusData = z.infer<typeof sseStatusDataSchema>;

// Errors ------------------------------------------------------------------

export const apiErrorSchema = z.object({
	error: z.string(),
	details: z.array(z.string()).optional()
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// GET /market/:slug (page data) ------------------------------------------

export const marketDashboardSchema = z.object({
	market: z.object({
		id: z.string(),
		name: z.string(),
		country: z.string(),
		countryName: z.string(),
		localityName: z.string(),
		lat: z.number(),
		lon: z.number(),
		timezone: z.string(),
		note: z.string().optional(),
		sampleArtists: z.array(z.string()),
		outlets: z.array(
			z.object({ name: z.string(), url: z.string(), rss: z.string(), lang: z.enum(['es', 'en']) })
		)
	}),
	/** Classified news of the last 60 days, advisories and the decayed score. */
	feed: riskFeedSchema,
	/** Holidays and long weekends for the next six months plus monthly climate normals. */
	calendar: marketCalendarSchema,
	recentBriefs: z.array(briefListItemSchema),
	generatedAt: z.string()
});
export type MarketDashboard = z.infer<typeof marketDashboardSchema>;
