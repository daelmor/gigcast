import { sql } from 'drizzle-orm';
import {
	bigserial,
	boolean,
	check,
	date,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

export const qlooCache = pgTable(
	'qloo_cache',
	{
		// Normalized request key: endpoint + sorted query params, computed by the caller.
		id: text('id').primaryKey(),
		endpoint: text('endpoint').notNull(),
		params: jsonb('params').notNull(),
		status: integer('status').notNull(),
		response: jsonb('response').notNull(),
		fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
		latencyMs: integer('latency_ms'),
		// First 6 chars of a sha256 of the API key, never the key itself.
		apiKeyFingerprint: text('api_key_fingerprint')
	},
	(t) => [index('qloo_cache_endpoint_idx').on(t.endpoint)]
);

export type QlooCacheRow = typeof qlooCache.$inferSelect;
export type NewQlooCacheRow = typeof qlooCache.$inferInsert;

export const markets = pgTable('markets', {
	// Slug, e.g. `guatemala-city`.
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	// ISO 3166-1 alpha-2.
	country: text('country').notNull(),
	// Qloo locality entity id.
	localityEntityId: text('locality_entity_id'),
	localityName: text('locality_name'),
	lat: doublePrecision('lat'),
	lon: doublePrecision('lon'),
	timezone: text('timezone'),
	// Array of `{ name, url, rss }`.
	outlets: jsonb('outlets')
		.notNull()
		.default(sql`'[]'::jsonb`),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;

// Accounts (Google sign-in) and their sessions. Reading briefs needs no account; creating one
// does when AUTH_MODE=required. The session id is the SHA-256 of the cookie token.
export const users = pgTable(
	'users',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		name: text('name'),
		picture: text('picture'),
		googleSub: text('google_sub'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('users_email_idx').on(t.email),
		uniqueIndex('users_google_sub_idx').on(t.googleSub)
	]
);

export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)]
);

export const briefs = pgTable(
	'briefs',
	{
		id: text('id').primaryKey(),
		marketId: text('market_id').references(() => markets.id, { onDelete: 'set null' }),
		// Who asked for the brief, when authentication is on; null for briefs created without it.
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		artistName: text('artist_name').notNull(),
		city: text('city'),
		country: text('country'),
		artistEntityId: text('artist_entity_id'),
		localityEntityId: text('locality_entity_id'),
		localityName: text('locality_name'),
		lat: doublePrecision('lat'),
		lon: doublePrecision('lon'),
		dateFrom: date('date_from'),
		dateTo: date('date_to'),
		promoterInputs: jsonb('promoter_inputs'),
		// The full BriefInput as submitted, so a brief can be re-run or displayed before it finishes.
		input: jsonb('input'),
		// queued | running | complete | partial | failed
		status: text('status').notNull(),
		// Null until the run completes.
		brief: jsonb('brief'),
		markdown: text('markdown'),
		// Set when the run failed or ended partial.
		error: text('error'),
		isPublic: boolean('is_public').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('briefs_market_id_idx').on(t.marketId),
		index('briefs_user_id_idx').on(t.userId),
		index('briefs_created_at_idx').on(t.createdAt),
		check(
			'briefs_status_check',
			sql`${t.status} in ('queued', 'running', 'complete', 'partial', 'failed')`
		)
	]
);

export type Brief = typeof briefs.$inferSelect;
export type NewBrief = typeof briefs.$inferInsert;

export const briefRuns = pgTable(
	'brief_runs',
	{
		id: text('id').primaryKey(),
		briefId: text('brief_id')
			.notNull()
			.references(() => briefs.id, { onDelete: 'cascade' }),
		// main | counterfactual
		kind: text('kind').notNull(),
		model: text('model').notNull(),
		status: text('status').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		inputTokens: integer('input_tokens').notNull().default(0),
		outputTokens: integer('output_tokens').notNull().default(0),
		cacheReadInputTokens: integer('cache_read_input_tokens').notNull().default(0),
		cacheCreationInputTokens: integer('cache_creation_input_tokens').notNull().default(0),
		qlooCalls: integer('qloo_calls').notNull().default(0),
		qlooCacheHits: integer('qloo_cache_hits').notNull().default(0),
		toolCalls: integer('tool_calls').notNull().default(0),
		error: text('error')
	},
	(t) => [index('brief_runs_brief_id_idx').on(t.briefId)]
);

export type BriefRun = typeof briefRuns.$inferSelect;
export type NewBriefRun = typeof briefRuns.$inferInsert;

export const agentEvents = pgTable(
	'agent_events',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => briefRuns.id, { onDelete: 'cascade' }),
		seq: integer('seq').notNull(),
		type: text('type').notNull(),
		payload: jsonb('payload').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('agent_events_run_id_seq_idx').on(t.runId, t.seq)]
);

export type AgentEvent = typeof agentEvents.$inferSelect;
export type NewAgentEvent = typeof agentEvents.$inferInsert;

export const newsItems = pgTable(
	'news_items',
	{
		// sha256 of the canonical url, computed by the app.
		id: text('id').primaryKey(),
		marketId: text('market_id').references(() => markets.id, { onDelete: 'cascade' }),
		url: text('url').notNull(),
		canonicalUrl: text('canonical_url').notNull().unique(),
		title: text('title').notNull(),
		snippet: text('snippet'),
		source: text('source'),
		lang: text('lang'),
		// The search query that found this item.
		query: text('query'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('news_items_market_published_idx').on(t.marketId, t.publishedAt)]
);

export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;

export const newsClassifications = pgTable('news_classifications', {
	newsItemId: text('news_item_id')
		.primaryKey()
		.references(() => newsItems.id, { onDelete: 'cascade' }),
	category: text('category').notNull(),
	severity: integer('severity').notNull(),
	affectedEntities: jsonb('affected_entities')
		.notNull()
		.default(sql`'[]'::jsonb`),
	timeHorizon: text('time_horizon'),
	confidence: real('confidence'),
	soWhat: text('so_what'),
	model: text('model').notNull(),
	classifiedAt: timestamp('classified_at', { withTimezone: true }).notNull().defaultNow()
});

export type NewsClassification = typeof newsClassifications.$inferSelect;
export type NewNewsClassification = typeof newsClassifications.$inferInsert;

export const holidaysCache = pgTable('holidays_cache', {
	// `${country}-${year}`
	id: text('id').primaryKey(),
	country: text('country').notNull(),
	year: integer('year').notNull(),
	payload: jsonb('payload').notNull(),
	fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow()
});

export type HolidaysCacheRow = typeof holidaysCache.$inferSelect;
export type NewHolidaysCacheRow = typeof holidaysCache.$inferInsert;

export const weatherCache = pgTable('weather_cache', {
	// App-computed key.
	id: text('id').primaryKey(),
	lat: doublePrecision('lat').notNull(),
	lon: doublePrecision('lon').notNull(),
	dateFrom: date('date_from').notNull(),
	dateTo: date('date_to').notNull(),
	payload: jsonb('payload').notNull(),
	fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow()
});

export type WeatherCacheRow = typeof weatherCache.$inferSelect;
export type NewWeatherCacheRow = typeof weatherCache.$inferInsert;
