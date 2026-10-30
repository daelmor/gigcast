/**
 * Cache stores for Qloo responses. Every response is persisted keyed by the
 * normalized request (endpoint + sorted params) so the product can serve
 * repeated questions without calling the API, and keep working from the cache
 * alone once the hackathon key is deactivated (replay mode).
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { getDb } from '../db/index.ts';
import { qlooCache } from '../db/schema.ts';

export interface CachedResponse {
	/** Normalized request key, see params.ts cacheKey(). */
	key: string;
	endpoint: string;
	params: Record<string, string>;
	status: number;
	body: unknown;
	fetchedAt: string;
	latencyMs?: number;
	/** First 6 hex chars of sha256(api key); never the key. */
	apiKeyFingerprint?: string;
}

export interface QlooCacheStore {
	get(key: string): Promise<CachedResponse | undefined>;
	set(entry: CachedResponse): Promise<void>;
}

/** Stable id for a request key (sha256 hex). */
export function cacheId(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

export function apiKeyFingerprint(apiKey: string): string {
	return createHash('sha256').update(apiKey).digest('hex').slice(0, 6);
}

export class MemoryCacheStore implements QlooCacheStore {
	private readonly map = new Map<string, CachedResponse>();
	async get(key: string): Promise<CachedResponse | undefined> {
		return this.map.get(key);
	}
	async set(entry: CachedResponse): Promise<void> {
		this.map.set(entry.key, entry);
	}
	get size(): number {
		return this.map.size;
	}
}

/** One JSON file per request under `dir`; also the format of exported replay bundles. */
export class FileCacheStore implements QlooCacheStore {
	constructor(private readonly dir: string) {}

	private file(key: string): string {
		return path.join(this.dir, `${cacheId(key)}.json`);
	}

	async get(key: string): Promise<CachedResponse | undefined> {
		const file = this.file(key);
		if (!existsSync(file)) return undefined;
		const raw = await readFile(file, 'utf8');
		return JSON.parse(raw) as CachedResponse;
	}

	async set(entry: CachedResponse): Promise<void> {
		await mkdir(this.dir, { recursive: true });
		const file = this.file(entry.key);
		const tmp = `${file}.${process.pid}.tmp`;
		const content = JSON.stringify(entry, null, 2);
		JSON.parse(content); // validate before replacing the destination
		await writeFile(tmp, content, 'utf8');
		await rename(tmp, file);
	}
}

type Db = ReturnType<typeof getDb>;

/** Postgres-backed store on the qloo_cache table. */
export class PostgresCacheStore implements QlooCacheStore {
	constructor(private readonly db: Db) {}

	async get(key: string): Promise<CachedResponse | undefined> {
		const rows = await this.db
			.select()
			.from(qlooCache)
			.where(eq(qlooCache.id, cacheId(key)))
			.limit(1);
		const row = rows[0];
		if (!row) return undefined;
		return {
			key,
			endpoint: row.endpoint,
			params: row.params as Record<string, string>,
			status: row.status,
			body: row.response,
			fetchedAt: row.fetchedAt.toISOString(),
			latencyMs: row.latencyMs ?? undefined,
			apiKeyFingerprint: row.apiKeyFingerprint ?? undefined
		};
	}

	async set(entry: CachedResponse): Promise<void> {
		const values = {
			id: cacheId(entry.key),
			endpoint: entry.endpoint,
			params: entry.params,
			status: entry.status,
			response: entry.body as object,
			fetchedAt: new Date(entry.fetchedAt),
			latencyMs: entry.latencyMs ?? null,
			apiKeyFingerprint: entry.apiKeyFingerprint ?? null
		};
		await this.db
			.insert(qlooCache)
			.values(values)
			.onConflictDoUpdate({
				target: qlooCache.id,
				set: {
					status: values.status,
					response: values.response,
					fetchedAt: values.fetchedAt,
					latencyMs: values.latencyMs,
					apiKeyFingerprint: values.apiKeyFingerprint
				}
			});
	}
}

/** Reads fall through from the first store that has the key; writes go to every store. */
export class LayeredCacheStore implements QlooCacheStore {
	constructor(private readonly stores: QlooCacheStore[]) {}

	async get(key: string): Promise<CachedResponse | undefined> {
		for (let i = 0; i < this.stores.length; i++) {
			const hit = await this.stores[i].get(key);
			if (hit) {
				// Backfill the faster stores in front of the one that answered.
				await Promise.all(this.stores.slice(0, i).map((s) => s.set(hit)));
				return hit;
			}
		}
		return undefined;
	}

	async set(entry: CachedResponse): Promise<void> {
		await Promise.all(this.stores.map((s) => s.set(entry)));
	}
}
