/**
 * Typed Qloo client: parameter whitelist, cache-first requests, replay mode,
 * rate limiting (10 req/s published by the API), retries and Zod parsing.
 *
 * Every result carries the originating request so downstream consumers (the
 * agent tools, the brief) can cite exactly which Qloo call produced it.
 */
import type { z } from 'zod';
import { apiKeyFingerprint, MemoryCacheStore, type QlooCacheStore } from './cache.ts';
import {
	assertAllowedParams,
	cacheKey,
	normalizeParams,
	type EntityType,
	type QlooParams,
	type SearchType
} from './params.ts';
import {
	audiencesResponseSchema,
	audienceTypesResponseSchema,
	compareResponseSchema,
	demographicsResponseSchema,
	entitiesResponseSchema,
	entityInsightsResponseSchema,
	extractErrorMessage,
	heatmapLocalityResponseSchema,
	heatmapResponseSchema,
	searchResponseSchema,
	tagInsightsResponseSchema,
	tagsResponseSchema,
	trendingResponseSchema
} from './schemas.ts';

export const QLOO_HACKATHON_BASE_URL = 'https://hackathon.api.qloo.com';

/**
 * live: cache first, call the API on a miss.
 * replay: cache only; a miss throws QlooReplayMissError (used after the key dies and in tests).
 * refresh: always call the API and overwrite the cache.
 */
export type QlooMode = 'live' | 'replay' | 'refresh';

export interface QlooRequestRef {
	endpoint: string;
	params: Record<string, string>;
	/** Normalized key, also the cache key. */
	key: string;
}

export interface QlooResult<T> {
	data: T;
	request: QlooRequestRef;
	cacheHit: boolean;
	status: number;
	fetchedAt: string;
	latencyMs?: number;
}

export interface QlooRequestEvent extends QlooRequestRef {
	cacheHit: boolean;
	status: number;
	latencyMs: number;
	error?: string;
}

export interface QlooClientOptions {
	apiKey?: string;
	baseUrl?: string;
	mode?: QlooMode;
	store?: QlooCacheStore;
	fetchImpl?: typeof fetch;
	/** Requests per second ceiling; the API publishes 10. */
	maxRequestsPerSecond?: number;
	maxRetries?: number;
	timeoutMs?: number;
	onRequest?: (event: QlooRequestEvent) => void;
}

export class QlooError extends Error {
	readonly status: number;
	readonly request: QlooRequestRef;
	readonly body: unknown;
	constructor(message: string, status: number, request: QlooRequestRef, body?: unknown) {
		super(message);
		this.name = 'QlooError';
		this.status = status;
		this.request = request;
		this.body = body;
	}
}

export class QlooReplayMissError extends QlooError {
	constructor(request: QlooRequestRef) {
		super(`No cached Qloo response for ${request.key} (replay mode)`, 0, request);
		this.name = 'QlooReplayMissError';
	}
}

export class QlooShapeError extends QlooError {
	readonly issues: string[];
	constructor(request: QlooRequestRef, issues: string[], body: unknown) {
		super(
			`Unexpected Qloo response shape for ${request.endpoint}: ${issues.slice(0, 3).join('; ')}`,
			200,
			request,
			body
		);
		this.name = 'QlooShapeError';
		this.issues = issues;
	}
}

export interface QlooStats {
	requests: number;
	cacheHits: number;
	liveCalls: number;
	errors: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class QlooClient {
	readonly mode: QlooMode;
	readonly stats: QlooStats = { requests: 0, cacheHits: 0, liveCalls: 0, errors: 0 };

	private readonly apiKey: string | undefined;
	private readonly baseUrl: string;
	private readonly store: QlooCacheStore;
	private readonly memory = new MemoryCacheStore();
	private readonly fetchImpl: typeof fetch;
	private readonly maxRps: number;
	private readonly maxRetries: number;
	private readonly timeoutMs: number;
	private readonly onRequest?: (event: QlooRequestEvent) => void;
	private readonly fingerprint: string | undefined;
	private slots: number[] = [];

	constructor(options: QlooClientOptions = {}) {
		this.apiKey = options.apiKey;
		this.baseUrl = (options.baseUrl ?? QLOO_HACKATHON_BASE_URL).replace(/\/+$/, '');
		this.mode = options.mode ?? 'live';
		this.store = options.store ?? new MemoryCacheStore();
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.maxRps = options.maxRequestsPerSecond ?? 8;
		this.maxRetries = options.maxRetries ?? 3;
		this.timeoutMs = options.timeoutMs ?? 20_000;
		this.onRequest = options.onRequest;
		this.fingerprint = this.apiKey ? apiKeyFingerprint(this.apiKey) : undefined;
		if (this.mode !== 'replay' && !this.apiKey) {
			throw new Error('QlooClient needs an apiKey unless mode is "replay"');
		}
	}

	// -------------------------------------------------------------------------
	// Generic request
	// -------------------------------------------------------------------------

	async request<T>(
		endpoint: string,
		params: QlooParams,
		schema: z.ZodType<T>
	): Promise<QlooResult<T>> {
		assertAllowedParams(endpoint, params);
		const normalized = normalizeParams(params);
		const key = cacheKey(endpoint, params);
		const ref: QlooRequestRef = { endpoint, params: normalized, key };
		this.stats.requests++;

		if (this.mode !== 'refresh') {
			const cached = (await this.memory.get(key)) ?? (await this.store.get(key));
			if (cached) {
				await this.memory.set(cached);
				this.stats.cacheHits++;
				this.onRequest?.({ ...ref, cacheHit: true, status: cached.status, latencyMs: 0 });
				return this.finish(
					ref,
					cached.status,
					cached.body,
					schema,
					true,
					cached.fetchedAt,
					cached.latencyMs
				);
			}
		}
		if (this.mode === 'replay') {
			this.stats.errors++;
			throw new QlooReplayMissError(ref);
		}

		const { status, body, latencyMs } = await this.fetchWithRetry(endpoint, normalized, ref);
		const fetchedAt = new Date().toISOString();
		this.stats.liveCalls++;
		// Validate before caching so a malformed 200 is never served from cache later.
		if (status === 200 && !schema.safeParse(body).success) {
			this.onRequest?.({
				...ref,
				cacheHit: false,
				status,
				latencyMs,
				error: 'unexpected response shape'
			});
			return this.finish(ref, status, body, schema, false, fetchedAt, latencyMs);
		}
		// Cache successes and deterministic client errors; never 429/5xx.
		if (status === 200 || (status >= 400 && status < 429)) {
			const entry = {
				key,
				endpoint,
				params: normalized,
				status,
				body,
				fetchedAt,
				latencyMs,
				apiKeyFingerprint: this.fingerprint
			};
			await this.memory.set(entry);
			await this.store.set(entry);
		}
		this.onRequest?.({
			...ref,
			cacheHit: false,
			status,
			latencyMs,
			error: status === 200 ? undefined : extractErrorMessage(body)
		});
		return this.finish(ref, status, body, schema, false, fetchedAt, latencyMs);
	}

	private finish<T>(
		ref: QlooRequestRef,
		status: number,
		body: unknown,
		schema: z.ZodType<T>,
		cacheHit: boolean,
		fetchedAt: string,
		latencyMs?: number
	): QlooResult<T> {
		if (status !== 200) {
			this.stats.errors++;
			throw new QlooError(
				`Qloo ${ref.endpoint} returned ${status}: ${extractErrorMessage(body) ?? 'no error message'}`,
				status,
				ref,
				body
			);
		}
		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			this.stats.errors++;
			throw new QlooShapeError(
				ref,
				parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
				body
			);
		}
		return { data: parsed.data, request: ref, cacheHit, status, fetchedAt, latencyMs };
	}

	private async fetchWithRetry(
		endpoint: string,
		params: Record<string, string>,
		ref: QlooRequestRef
	): Promise<{ status: number; body: unknown; latencyMs: number }> {
		const url = new URL(this.baseUrl + endpoint);
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
		let lastError: unknown;
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			await this.throttle();
			const t0 = performance.now();
			try {
				const res = await this.fetchImpl(url, {
					headers: { 'X-Api-Key': this.apiKey as string, accept: 'application/json' },
					signal: AbortSignal.timeout(this.timeoutMs)
				});
				const latencyMs = Math.round(performance.now() - t0);
				const text = await res.text();
				let body: unknown;
				try {
					body = JSON.parse(text);
				} catch {
					body = text.slice(0, 500);
				}
				if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
					const retryAfter = Number(res.headers.get('retry-after'));
					await sleep(
						Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt
					);
					continue;
				}
				return { status: res.status, body, latencyMs };
			} catch (err) {
				lastError = err;
				if (attempt < this.maxRetries) {
					await sleep(500 * 2 ** attempt);
					continue;
				}
			}
		}
		this.stats.errors++;
		throw new QlooError(
			`Qloo ${endpoint} unreachable: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
			0,
			ref
		);
	}

	/** Reserve a send slot so at most maxRps requests start in any rolling second. */
	private async throttle(): Promise<void> {
		const now = Date.now();
		this.slots = this.slots.filter((t) => t > now - 1000);
		const at =
			this.slots.length < this.maxRps ? now : this.slots[this.slots.length - this.maxRps] + 1000;
		this.slots.push(at);
		if (at > now) await sleep(at - now);
	}

	// -------------------------------------------------------------------------
	// Typed helpers
	// -------------------------------------------------------------------------

	search(query: string, type: SearchType, opts: { take?: number; page?: number } = {}) {
		return this.request(
			'/search',
			{ query, types: type, take: opts.take ?? 5, page: opts.page },
			searchResponseSchema
		);
	}

	/** /v2/insights for an entity type. Callers pass Qloo parameter names verbatim. */
	insights(type: EntityType, params: QlooParams) {
		return this.request(
			'/v2/insights',
			{ ...params, 'filter.type': type },
			entityInsightsResponseSchema
		);
	}

	heatmap(params: QlooParams) {
		return this.request(
			'/v2/insights',
			{ ...params, 'filter.type': 'urn:heatmap', 'output.heatmap.boundary': undefined },
			heatmapResponseSchema
		);
	}

	heatmapByLocality(params: QlooParams) {
		return this.request(
			'/v2/insights',
			{ ...params, 'filter.type': 'urn:heatmap', 'output.heatmap.boundary': 'urn:entity:locality' },
			heatmapLocalityResponseSchema
		);
	}

	demographics(params: QlooParams) {
		return this.request(
			'/v2/insights',
			{ ...params, 'filter.type': 'urn:demographics' },
			demographicsResponseSchema
		);
	}

	tagInsights(params: QlooParams) {
		return this.request(
			'/v2/insights',
			{ ...params, 'filter.type': 'urn:tag' },
			tagInsightsResponseSchema
		);
	}

	tags(params: QlooParams) {
		return this.request('/v2/tags', params, tagsResponseSchema);
	}

	trending(params: QlooParams) {
		return this.request('/v2/trending', params, trendingResponseSchema);
	}

	compare(params: QlooParams) {
		return this.request('/v2/insights/compare', params, compareResponseSchema);
	}

	entities(ids: string[]) {
		return this.request('/entities', { entity_ids: ids.join(',') }, entitiesResponseSchema);
	}

	audienceTypes() {
		return this.request('/v2/audiences/types', { take: 50 }, audienceTypesResponseSchema);
	}

	audiences(parentType: string, take = 50) {
		return this.request(
			'/v2/audiences',
			{ 'filter.parents.types': parentType, take },
			audiencesResponseSchema
		);
	}
}

/** Join entity ids for a signal.interests.entities value. */
export function joinIds(ids: readonly string[]): string {
	return ids.join(',');
}
