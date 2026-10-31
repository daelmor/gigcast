import { z } from 'zod';

const schema = z.object({
	QLOO_API_KEY: z.string().min(1),
	QLOO_BASE_URL: z.string().url().default('https://hackathon.api.qloo.com'),
	// live: cache first, API on miss. replay: cache only (after the key dies). refresh: always call.
	QLOO_MODE: z.enum(['live', 'replay', 'refresh']).default('live'),
	QLOO_CACHE_BACKEND: z.enum(['postgres', 'file']).default('postgres'),
	QLOO_CACHE_DIR: z.string().min(1).default('.cache/qloo'),
	DATABASE_URL: z.string().min(1),
	GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
	GOOGLE_CLOUD_PROJECT: z.string().min(1),
	ANTHROPIC_VERTEX_REGION: z.string().min(1).default('global'),
	// Vertex model ids. Claude 5.x is listed but not enabled for the project yet (see docs/decisions.md).
	CLAUDE_PLANNER_MODEL: z.string().min(1).default('claude-opus-4-6'),
	CLAUDE_CLASSIFIER_MODEL: z.string().min(1).default('claude-haiku-4-5'),
	// Required only by the ingest job endpoint, which checks it at request time.
	INGEST_JOB_SECRET: z.string().min(1).optional(),
	PUBLIC_MAP_STYLE_URL: z.string().url().optional(),
	PUBLIC_MAP_STYLE_URL_DARK: z.string().url().optional(),
	APP_BASE_URL: z.string().url().optional(),
	// Briefs running at the same time in one instance; the next MAX_QUEUED_RUNS wait in a
	// first-in, first-out queue, and more than that are refused with 429.
	MAX_CONCURRENT_RUNS: z.coerce.number().int().positive().default(2),
	MAX_QUEUED_RUNS: z.coerce.number().int().nonnegative().default(6),
	// on also runs the tool-less counterfactual next to every brief (the document no longer shows
	// it); off saves one model call per brief.
	COUNTERFACTUAL_RUN: z.enum(['on', 'off']).default('off'),
	// vertex (default) runs the real agent; fake replays a canned trace for end-to-end tests.
	AGENT_RUNNER: z.enum(['vertex', 'fake']).default('vertex'),
	// Apply pending Drizzle migrations when the server starts (Cloud Run has no shell step).
	MIGRATE_ON_START: z
		.enum(['true', 'false', '1', '0'])
		.default('false')
		.transform((v) => v === 'true' || v === '1')
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Treat empty strings as unset so `VAR=` lines in a dotenv file behave like absent variables. */
function readProcessEnv(): Record<string, string | undefined> {
	const out: Record<string, string | undefined> = {};
	for (const key of Object.keys(schema.shape)) {
		const value = process.env[key];
		out[key] = value === undefined || value === '' ? undefined : value;
	}
	return out;
}

/**
 * Parse and cache the environment on first use. Errors list variable names only,
 * never values, so they are safe to log.
 */
export function getEnv(): Env {
	if (cached) return cached;
	const raw = readProcessEnv();
	const result = schema.safeParse(raw);
	if (!result.success) {
		const missing = new Set<string>();
		const invalid = new Set<string>();
		for (const issue of result.error.issues) {
			const name = String(issue.path[0]);
			if (raw[name] === undefined) missing.add(name);
			else invalid.add(name);
		}
		const parts: string[] = [];
		if (missing.size) parts.push(`Missing environment variables: ${[...missing].join(', ')}`);
		if (invalid.size) parts.push(`Invalid environment variables: ${[...invalid].join(', ')}`);
		throw new Error(parts.join('. '));
	}
	cached = result.data;
	return cached;
}

/** Test helper: drop the cached parse so the next getEnv() re-reads process.env. */
export function resetEnvCache(): void {
	cached = undefined;
}
