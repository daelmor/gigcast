import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
