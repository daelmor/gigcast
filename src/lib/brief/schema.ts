/**
 * The Booking Brief contract, shared by the agent (which emits a BriefDraft
 * through the emit_brief tool), the server (which assembles the final Brief
 * from the draft plus the raw tool artifacts), the Markdown renderer, the web
 * UI and the tests. No server-only imports here.
 *
 * Labels: every recommendation is `grounded` (backed by a Qloo result the
 * server can verify), `inferred` (the model's reasoning on top of grounded
 * data) or `no_coverage` (Qloo returned nothing usable; say so, never invent).
 */
import { z } from 'zod';

export const labelSchema = z.enum(['grounded', 'inferred', 'no_coverage']);
export type Label = z.infer<typeof labelSchema>;

export const LABEL_HELP: Record<Label, string> = {
	grounded:
		'Backed by a result in the taste graph; the entity id was returned by the cited tool call.',
	inferred: 'The model reasoned on top of grounded data; not itself a data result.',
	no_coverage: 'The taste graph returned nothing usable for this item or section.'
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const promoterInputsSchema = z.object({
	venues: z
		.array(z.object({ name: z.string(), capacity: z.number().int().positive().optional() }))
		.optional(),
	ticketPriceRange: z
		.object({
			min: z.number().nonnegative(),
			max: z.number().nonnegative(),
			currency: z.string().length(3)
		})
		.optional(),
	budget: z.object({ amount: z.number().nonnegative(), currency: z.string().length(3) }).optional(),
	pastSales: z
		.array(
			z.object({
				event: z.string(),
				date: isoDate.optional(),
				sold: z.number().int().nonnegative(),
				capacity: z.number().int().positive().optional()
			})
		)
		.optional(),
	notes: z.string().max(2000).optional()
});
export type PromoterInputs = z.infer<typeof promoterInputsSchema>;

export const briefInputSchema = z.object({
	artist: z.string().min(1),
	city: z.string().min(1),
	/** ISO 3166-1 alpha-2 preferred; a country name also works. */
	country: z.string().min(2),
	dateFrom: isoDate,
	dateTo: isoDate,
	promoter: promoterInputsSchema.optional(),
	/** Set when the promoter confirmed the artist in the UI; the agent still verifies it. */
	artistEntityId: z.string().min(1).optional(),
	/** Set when the promoter confirmed the Qloo locality in the UI (defeats the free-text traps). */
	localityEntityId: z.string().min(1).optional(),
	localityName: z.string().min(1).optional()
});
export type BriefInput = z.infer<typeof briefInputSchema>;

// ---------------------------------------------------------------------------
// Draft: what the agent emits through emit_brief
// ---------------------------------------------------------------------------

/** Tool call ids (from the agent trace) that justify an item. */
const sources = z.array(z.string()).default([]);

export const sectionNoteSchema = z.object({
	label: labelSchema,
	/** Two to five sentences a promoter can read on its own. */
	summary: z.string().min(1).max(3000),
	caveats: z.array(z.string().max(600)).max(10).default([])
});
export type SectionNote = z.infer<typeof sectionNoteSchema>;

export const hotspotSchema = z.object({
	name: z.string().max(200),
	lat: z.number(),
	lon: z.number(),
	geohash: z.string().optional(),
	why: z.string().max(800),
	label: labelSchema,
	sources
});

export const artistPickSchema = z.object({
	entityId: z.string(),
	name: z.string(),
	role: z.enum(['co_headliner', 'opener', 'support']),
	affinity: z.number().min(0).max(1).optional(),
	why: z.string().max(1200),
	label: labelSchema,
	sources
});
export type ArtistPick = z.infer<typeof artistPickSchema>;

export const sponsorPickSchema = z.object({
	entityId: z.string(),
	name: z.string(),
	affinity: z.number().min(0).max(1).optional(),
	category: z.string().max(120).optional(),
	why: z.string().max(1600),
	outreachDraft: z.object({ subject: z.string().max(300), body: z.string().max(5000) }),
	label: labelSchema,
	sources
});
export type SponsorPick = z.infer<typeof sponsorPickSchema>;

export const placePickSchema = z.object({
	entityId: z.string(),
	name: z.string(),
	kind: z.enum(['venue', 'pre_party', 'hospitality', 'bundle_partner', 'after_party']),
	address: z.string().max(500).optional(),
	lat: z.number().optional(),
	lon: z.number().optional(),
	priceLevel: z.number().int().min(1).max(4).optional(),
	rating: z.number().min(0).max(5).optional(),
	why: z.string().max(1000),
	label: labelSchema,
	sources
});
export type PlacePick = z.infer<typeof placePickSchema>;

export const priceTierSchema = z.object({
	name: z.string().max(120),
	price: z.number().nonnegative(),
	/** Suggested share of capacity, 0 to 1. */
	share: z.number().min(0).max(1),
	rationale: z.string().max(800)
});

export const RISK_CATEGORIES = [
	'security',
	'weather_climate',
	'political_unrest_elections',
	'economic_shock',
	'health',
	'venue_infrastructure',
	'artist_controversy',
	'competing_events',
	'permits_regulation',
	'transport',
	'other'
] as const;
export const riskCategorySchema = z.enum(RISK_CATEGORIES);

export const TIME_HORIZONS = ['past', 'ongoing', 'in_window', 'after_window', 'unknown'] as const;
export const timeHorizonSchema = z.enum(TIME_HORIZONS);

export const riskItemSchema = z.object({
	category: riskCategorySchema,
	severity: z.number().int().min(1).max(5),
	title: z.string().max(300),
	soWhat: z.string().max(800),
	sourceName: z.string().max(120),
	/** Every risk links to its source; the server checks it against the risk feed the tool returned. */
	sourceUrl: z.string().url(),
	publishedAt: z.string().optional(),
	timeHorizon: timeHorizonSchema.optional(),
	label: labelSchema
});
export type RiskItem = z.infer<typeof riskItemSchema>;

export const briefDraftSchema = z.object({
	headline: z.string().min(1).max(300),
	verdict: z.enum(['promising', 'mixed', 'weak', 'insufficient_data']),
	keyPoints: z.array(z.string().max(600)).min(1).max(10),
	audience: z.object({
		note: sectionNoteSchema,
		hotspots: z.array(hotspotSchema).max(12).default([])
	}),
	demandAndFit: z.object({
		note: sectionNoteSchema,
		popularity: z.number().min(0).max(1).optional(),
		trend: z
			.object({
				direction: z.enum(['rising', 'flat', 'falling', 'unknown']),
				detail: z.string().max(800),
				label: labelSchema
			})
			.optional(),
		demographics: z
			.object({
				topAgeBuckets: z.array(z.string()).max(6),
				genderSkew: z.enum(['male', 'female', 'balanced', 'unknown']),
				label: labelSchema
			})
			.optional(),
		tasteMatch: z
			.object({
				score: z.number().min(0).max(1).optional(),
				sharedTags: z.array(z.string()).max(24),
				detail: z.string().max(1200),
				label: labelSchema
			})
			.optional()
	}),
	lineup: z.object({
		note: sectionNoteSchema,
		picks: z.array(artistPickSchema).max(12).default([])
	}),
	sponsors: z.object({
		note: sectionNoteSchema,
		picks: z.array(sponsorPickSchema).max(12).default([])
	}),
	venuesAndPartners: z.object({
		note: sectionNoteSchema,
		picks: z.array(placePickSchema).max(20).default([])
	}),
	pricing: z.object({
		note: sectionNoteSchema,
		currency: z.string().length(3),
		tiers: z.array(priceTierSchema).max(6).default([]),
		assumptions: z.array(z.string().max(600)).max(10).default([])
	}),
	risks: z
		.object({ note: sectionNoteSchema, items: z.array(riskItemSchema).max(30).default([]) })
		.optional(),
	openQuestions: z.array(z.string().max(600)).max(12).default([])
});
export type BriefDraft = z.infer<typeof briefDraftSchema>;

// ---------------------------------------------------------------------------
// Artifacts: raw tool data the server attaches to the brief
// ---------------------------------------------------------------------------

export const sourceRefSchema = z.object({
	tool: z.string(),
	toolCallId: z.string(),
	endpoint: z.string(),
	/** Normalized Qloo request key (endpoint + sorted params). */
	requestKey: z.string(),
	cacheHit: z.boolean(),
	fetchedAt: z.string()
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const heatmapCellLiteSchema = z.object({
	geohash: z.string(),
	lat: z.number(),
	lon: z.number(),
	affinity: z.number(),
	popularity: z.number().nullable().optional(),
	quality: z.number().nullable().optional(),
	priceLevel: z.number().nullable().optional()
});
export type HeatmapCellLite = z.infer<typeof heatmapCellLiteSchema>;

export const candidateSchema = z.object({
	entityId: z.string(),
	name: z.string(),
	affinity: z.number().optional(),
	popularity: z.number().nullable().optional(),
	subtype: z.string().optional(),
	tags: z.array(z.string()).optional(),
	explainability: z
		.record(z.string(), z.array(z.object({ entityId: z.string(), score: z.number() })))
		.optional(),
	lat: z.number().optional(),
	lon: z.number().optional(),
	address: z.string().optional(),
	priceLevel: z.number().nullable().optional(),
	rating: z.number().nullable().optional(),
	image: z.string().optional()
});
export type Candidate = z.infer<typeof candidateSchema>;

const withSource = <T extends z.ZodType>(items: T) => z.object({ items, source: sourceRefSchema });

// Risk layer (M4): shapes shared by the agent tools, the artifacts and the market dashboard.

export const holidaySchema = z.object({
	date: isoDate,
	localName: z.string(),
	name: z.string(),
	/** True when the holiday falls inside the requested date window. */
	inWindow: z.boolean(),
	/** Day of week in English, e.g. "Friday". */
	weekday: z.string()
});
export type Holiday = z.infer<typeof holidaySchema>;

export const longWeekendSchema = z.object({
	start: isoDate,
	end: isoDate,
	days: z.number().int().min(3),
	holidays: z.array(z.string()),
	inWindow: z.boolean()
});
export type LongWeekend = z.infer<typeof longWeekendSchema>;

/** Climate for the date window from the last years' observations at the same dates. */
export const climateWindowSchema = z.object({
	years: z.array(z.number().int()),
	tmaxMean: z.number().nullable(),
	tminMean: z.number().nullable(),
	/** Mean total precipitation over the window, mm. */
	precipMean: z.number().nullable(),
	/** Share of days with at least 1 mm of rain, 0 to 1. */
	rainDayShare: z.number().nullable(),
	/** Highest daily precipitation seen on those dates in any year, mm. */
	precipMaxDay: z.number().nullable(),
	note: z.string().optional()
});
export type ClimateWindow = z.infer<typeof climateWindowSchema>;

export const climateMonthSchema = z.object({
	month: z.number().int().min(1).max(12),
	tmaxMean: z.number().nullable(),
	tminMean: z.number().nullable(),
	precipMean: z.number().nullable(),
	rainDays: z.number().nullable()
});
export type ClimateMonth = z.infer<typeof climateMonthSchema>;

export const marketCalendarShape = {
	country: z.string(),
	from: isoDate,
	to: isoDate,
	holidays: z.array(holidaySchema),
	longWeekends: z.array(longWeekendSchema),
	climate: climateWindowSchema.nullable(),
	climateMonths: z.array(climateMonthSchema).default([])
};
export const marketCalendarSchema = z.object(marketCalendarShape);
export type MarketCalendar = z.infer<typeof marketCalendarSchema>;

export const classifiedNewsSchema = z.object({
	id: z.string(),
	title: z.string(),
	url: z.string(),
	source: z.string().nullable(),
	publishedAt: z.string().nullable(),
	snippet: z.string().nullable(),
	category: riskCategorySchema,
	severity: z.number().int().min(1).max(5),
	timeHorizon: timeHorizonSchema,
	confidence: z.number().min(0).max(1),
	soWhat: z.string(),
	affectedEntities: z.array(z.string()),
	/** Decayed weight used for the market score, 0 to 1. */
	weight: z.number().min(0).max(1),
	/** Mentions the artist or the venue the promoter asked about. */
	mentionsSubject: z.boolean().default(false)
});
export type ClassifiedNews = z.infer<typeof classifiedNewsSchema>;

export const travelAdvisorySchema = z.object({
	source: z.enum(['US State Department', 'UK FCDO']),
	title: z.string(),
	url: z.string(),
	publishedAt: z.string().nullable(),
	/** US advisory level 1 to 4 when the title carries it. */
	level: z.number().int().min(1).max(4).nullable(),
	summary: z.string().nullable()
});
export type TravelAdvisory = z.infer<typeof travelAdvisorySchema>;

export const riskScoreSchema = z.object({
	/** 0 (quiet) to 100 (loud), from decayed severity-weighted items. */
	value: z.number().int().min(0).max(100),
	byCategory: z.record(z.string(), z.number().int().min(0).max(100)),
	itemCount: z.number().int().nonnegative(),
	/** Items newer than seven days. */
	recentCount: z.number().int().nonnegative()
});
export type RiskScore = z.infer<typeof riskScoreSchema>;

export const riskFeedShape = {
	marketId: z.string().nullable(),
	country: z.string(),
	city: z.string(),
	from: isoDate,
	to: isoDate,
	items: z.array(classifiedNewsSchema),
	advisories: z.array(travelAdvisorySchema),
	score: riskScoreSchema,
	/** When the newest item in the store was fetched; null when nothing has been ingested yet. */
	ingestedAt: z.string().nullable(),
	/** Items stored for the market (before relevance filtering). */
	storedItems: z.number().int().nonnegative()
};
export const riskFeedSchema = z.object(riskFeedShape);
export type RiskFeed = z.infer<typeof riskFeedSchema>;

export const briefArtifactsSchema = z.object({
	/** Every tool call that made a Qloo request, so any cited tool call id resolves to a source. */
	calls: z.array(sourceRefSchema).default([]),
	heatmap: z
		.object({
			cells: z.array(heatmapCellLiteSchema),
			hasDimensions: z.boolean(),
			source: sourceRefSchema
		})
		.optional(),
	neighbourhoods: withSource(
		z.array(z.object({ entityId: z.string(), name: z.string(), affinity: z.number() }))
	).optional(),
	demographics: z
		.object({
			age: z.record(z.string(), z.number()),
			gender: z.record(z.string(), z.number()),
			source: sourceRefSchema
		})
		.optional(),
	trending: withSource(
		z.array(
			z.object({
				date: z.string(),
				percentile: z.number().nullable(),
				rank: z.number().nullable(),
				velocity: z.number().nullable()
			})
		)
	).optional(),
	artistTags: withSource(
		z.array(z.object({ id: z.string(), name: z.string(), affinity: z.number().optional() }))
	).optional(),
	cityTags: withSource(
		z.array(z.object({ id: z.string(), name: z.string(), affinity: z.number().optional() }))
	).optional(),
	cityArtists: withSource(z.array(candidateSchema)).optional(),
	lineupCandidates: withSource(z.array(candidateSchema)).optional(),
	sponsorCandidates: withSource(z.array(candidateSchema)).optional(),
	placeCandidates: z
		.array(z.object({ kind: z.string(), items: z.array(candidateSchema), source: sourceRefSchema }))
		.optional(),
	/** Deterministic context for the date window: holidays, long weekends, climate normals. */
	marketCalendar: z.object({ ...marketCalendarShape, source: sourceRefSchema }).optional(),
	/** Classified local news and travel advisories with a decayed market risk score. */
	riskFeed: z.object({ ...riskFeedShape, source: sourceRefSchema }).optional()
});
export type BriefArtifacts = z.infer<typeof briefArtifactsSchema>;

// ---------------------------------------------------------------------------
// Final brief
// ---------------------------------------------------------------------------

export const resolutionSchema = z.object({
	artist: z.object({
		entityId: z.string(),
		name: z.string(),
		popularity: z.number().nullable().optional(),
		disambiguation: z.string().optional()
	}),
	locality: z.object({
		method: z.enum(['entity_id', 'point', 'unresolved']),
		entityId: z.string().optional(),
		name: z.string().optional(),
		disambiguation: z.string().optional(),
		lat: z.number().optional(),
		lon: z.number().optional(),
		candidates: z
			.array(
				z.object({
					entityId: z.string(),
					name: z.string(),
					disambiguation: z.string().optional(),
					acceptable: z.boolean()
				})
			)
			.default([])
	})
});
export type Resolution = z.infer<typeof resolutionSchema>;

export const usageSchema = z.object({
	inputTokens: z.number().int().nonnegative(),
	outputTokens: z.number().int().nonnegative(),
	cacheReadInputTokens: z.number().int().nonnegative(),
	cacheCreationInputTokens: z.number().int().nonnegative()
});
export type Usage = z.infer<typeof usageSchema>;

export const runSummarySchema = z.object({
	runId: z.string(),
	kind: z.enum(['main', 'counterfactual']),
	model: z.string(),
	status: z.enum(['complete', 'partial', 'failed']),
	startedAt: z.string(),
	finishedAt: z.string(),
	usage: usageSchema,
	toolCalls: z.number().int().nonnegative(),
	qlooCalls: z.number().int().nonnegative(),
	qlooCacheHits: z.number().int().nonnegative(),
	/** Tool calls that failed and were recovered by the agent (reflected in labels, not in status). */
	toolErrors: z.number().int().nonnegative().optional(),
	stopReason: z.string().optional(),
	missingSections: z.array(z.string()).default([]),
	error: z.string().optional()
});
export type RunSummary = z.infer<typeof runSummarySchema>;

/** Items whose grounded claim could not be verified against a tool result and were downgraded. */
export const verificationSchema = z.object({
	downgraded: z.array(
		z.object({ section: z.string(), entityId: z.string(), name: z.string(), reason: z.string() })
	),
	checked: z.number().int().nonnegative()
});
export type Verification = z.infer<typeof verificationSchema>;

// ---------------------------------------------------------------------------
// Counterfactual: the same question answered with the Qloo tools removed
// ---------------------------------------------------------------------------

export const confidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof confidenceSchema>;

/** A pick made from the model's own knowledge, without any tool. */
export const counterfactualPickSchema = z.object({
	name: z.string().min(1).max(200),
	/** Lineup picks only. */
	role: z.enum(['co_headliner', 'opener', 'support']).optional(),
	/** Sponsor picks only. */
	category: z.string().max(120).optional(),
	why: z.string().max(800),
	confidence: confidenceSchema
});
export type CounterfactualPick = z.infer<typeof counterfactualPickSchema>;

export const counterfactualDraftSchema = z.object({
	lineup: z.array(counterfactualPickSchema).max(8).default([]),
	sponsors: z.array(counterfactualPickSchema).max(8).default([]),
	/** What the model says it could not know without data. */
	caveats: z.array(z.string().max(600)).max(8).default([])
});
export type CounterfactualDraft = z.infer<typeof counterfactualDraftSchema>;

/** Server-side check of one LLM-only pick against what Qloo returned in the main run. */
export const counterfactualMatchSchema = z.object({
	/** Qloo candidate whose name matches the pick, if any. */
	entityId: z.string().optional(),
	qlooName: z.string().optional(),
	affinity: z.number().optional(),
	/** The grounded run also picked it. */
	pickedByGroundedRun: z.boolean()
});
export type CounterfactualMatch = z.infer<typeof counterfactualMatchSchema>;

export const counterfactualPanelSchema = z.object({
	status: z.enum(['complete', 'failed', 'skipped']),
	model: z.string(),
	run: runSummarySchema.optional(),
	draft: counterfactualDraftSchema.optional(),
	/** Parallel to draft.lineup and draft.sponsors. */
	matches: z
		.object({
			lineup: z.array(counterfactualMatchSchema),
			sponsors: z.array(counterfactualMatchSchema)
		})
		.optional(),
	summary: z
		.object({
			lineupTotal: z.number().int().nonnegative(),
			lineupInQloo: z.number().int().nonnegative(),
			lineupOverlap: z.number().int().nonnegative(),
			sponsorsTotal: z.number().int().nonnegative(),
			sponsorsInQloo: z.number().int().nonnegative(),
			sponsorsOverlap: z.number().int().nonnegative()
		})
		.optional(),
	error: z.string().optional()
});
export type CounterfactualPanel = z.infer<typeof counterfactualPanelSchema>;

export const briefSchema = z.object({
	version: z.literal(1),
	id: z.string(),
	createdAt: z.string(),
	input: briefInputSchema,
	resolution: resolutionSchema,
	draft: briefDraftSchema,
	artifacts: briefArtifactsSchema,
	verification: verificationSchema,
	run: runSummarySchema,
	/** Added in M3; briefs stored before then have none. */
	counterfactual: counterfactualPanelSchema.optional()
});
export type Brief = z.infer<typeof briefSchema>;

/** Section ids used in events and in the "missing sections" list. */
export const BRIEF_SECTIONS = [
	'audience',
	'demandAndFit',
	'lineup',
	'sponsors',
	'venuesAndPartners',
	'pricing',
	'risks'
] as const;
export type BriefSection = (typeof BRIEF_SECTIONS)[number];
