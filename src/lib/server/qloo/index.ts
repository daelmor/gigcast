/**
 * Qloo module entry point: the typed client, cache stores, parameter
 * whitelist, response schemas and the locality resolver, plus a factory that
 * wires the client from the environment.
 */
import { getDb } from '../db/index.ts';
import { getEnv } from '../env.ts';
import { FileCacheStore, PostgresCacheStore, type QlooCacheStore } from './cache.ts';
import { QlooClient, type QlooClientOptions, type QlooMode } from './client.ts';

export * from './cache.ts';
export * from './client.ts';
export * from './locality.ts';
export * from './params.ts';
export * from './schemas.ts';

export interface CreateQlooClientOptions extends Omit<
	QlooClientOptions,
	'apiKey' | 'baseUrl' | 'store'
> {
	mode?: QlooMode;
	/** Override the env-selected backend (postgres by default, file for tests and offline work). */
	backend?: 'postgres' | 'file';
	store?: QlooCacheStore;
}

/** Build the store the environment asks for. */
export function createCacheStore(backend?: 'postgres' | 'file'): QlooCacheStore {
	const env = getEnv();
	const chosen = backend ?? env.QLOO_CACHE_BACKEND;
	if (chosen === 'file') return new FileCacheStore(env.QLOO_CACHE_DIR);
	return new PostgresCacheStore(getDb());
}

/** Client wired from the environment: key, base URL, mode and cache backend. */
export function createQlooClient(options: CreateQlooClientOptions = {}): QlooClient {
	const env = getEnv();
	const mode = options.mode ?? env.QLOO_MODE;
	return new QlooClient({
		...options,
		apiKey: env.QLOO_API_KEY,
		baseUrl: env.QLOO_BASE_URL,
		mode,
		store: options.store ?? createCacheStore(options.backend)
	});
}

let shared: QlooClient | undefined;

/**
 * One client per process for request handlers, so the rate limiter and the
 * retry budget are shared across concurrent requests. Scripts and tests
 * should keep building their own with createQlooClient.
 */
export function getSharedQlooClient(): QlooClient {
	if (!shared) shared = createQlooClient();
	return shared;
}
