/**
 * Shared helpers for the Qloo tests: load the recorded live responses from
 * docs/qloo-samples and build a replay client from them. No network, no DB.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MemoryCacheStore, type CachedResponse } from './cache.ts';
import { QlooClient } from './client.ts';
import { cacheKey, normalizeParams, type QlooParams } from './params.ts';

export interface Sample {
	/** File stem, e.g. `heatmap.dimensions`. */
	id: string;
	endpoint: string;
	params: QlooParams;
	status: number;
	body: unknown;
}

export const FIXED_FETCHED_AT = '2026-10-30T08:30:00.000Z';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');
const SAMPLES_DIR = path.join(REPO_ROOT, 'docs', 'qloo-samples');

interface SampleFile {
	request: { endpoint: string; params: QlooParams };
	status: number;
	body: unknown;
}

/** Every docs/qloo-samples/*.json, sorted by file name. */
export function loadSamples(): Sample[] {
	return readdirSync(SAMPLES_DIR)
		.filter((f) => f.endsWith('.json'))
		.sort()
		.map((file) => {
			const raw = JSON.parse(readFileSync(path.join(SAMPLES_DIR, file), 'utf8')) as SampleFile;
			return {
				id: file.slice(0, -'.json'.length),
				endpoint: raw.request.endpoint,
				params: raw.request.params,
				status: raw.status,
				body: raw.body
			};
		});
}

export function cachedResponseFor(sample: Omit<Sample, 'id'>): CachedResponse {
	return {
		key: cacheKey(sample.endpoint, sample.params),
		endpoint: sample.endpoint,
		params: normalizeParams(sample.params),
		status: sample.status,
		body: sample.body,
		fetchedAt: FIXED_FETCHED_AT
	};
}

/** A MemoryCacheStore holding one entry per sample (later samples win on a key collision). */
export function seedStore(samples: Sample[]): MemoryCacheStore {
	const store = new MemoryCacheStore();
	for (const sample of samples) {
		// MemoryCacheStore.set resolves synchronously in effect (a plain Map write).
		void store.set(cachedResponseFor(sample));
	}
	return store;
}

export function replayClient(samples: Sample[]): QlooClient {
	return new QlooClient({ mode: 'replay', store: seedStore(samples) });
}

/** A fresh JSON Response; build one per call because bodies can only be read once. */
export function jsonResponse(
	body: unknown,
	status = 200,
	headers?: Record<string, string>
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	});
}
