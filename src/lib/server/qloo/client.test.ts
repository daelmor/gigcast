import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore } from './cache.ts';
import {
	QlooClient,
	QlooError,
	QlooReplayMissError,
	QlooShapeError,
	type QlooRequestEvent
} from './client.ts';
import { cacheKey, QlooParamError } from './params.ts';
import { searchResponseSchema } from './schemas.ts';
import { jsonResponse, loadSamples, replayClient, seedStore } from './test-support.ts';

const searchBody = { results: [{ name: 'Bad Bunny', entity_id: 'abc' }] };

function liveClient(
	fetchImpl: typeof fetch,
	extra: Partial<ConstructorParameters<typeof QlooClient>[0]> = {}
) {
	const store = new MemoryCacheStore();
	const client = new QlooClient({ apiKey: 'test-key', store, fetchImpl, ...extra });
	return { client, store };
}

function mockFetch(impl: () => Response | Promise<Response>) {
	return vi.fn<typeof fetch>(async () => impl());
}

/** The URL passed to the nth fetch call. */
function calledUrl(fetchImpl: ReturnType<typeof mockFetch>, n = 0): URL {
	return new URL(String(fetchImpl.mock.calls[n][0]));
}

describe('replay mode', () => {
	const samples = loadSamples();
	// auth.hackathon (200) and auth.production (401) record the same request, so they share
	// a cache key. Seed only the successful samples to get the 200 body.
	const ok = samples.filter((s) => s.status === 200);

	it('serves a cached response without touching fetch', async () => {
		const fetchImpl = vi.fn<typeof fetch>();
		const client = new QlooClient({
			mode: 'replay',
			store: seedStore(ok),
			fetchImpl
		});
		const res = await client.search('Bad Bunny', 'urn:entity:artist', { take: 2 });
		const sample = samples.find((s) => s.id === 'auth.hackathon')!;
		expect(res.data).toEqual(searchResponseSchema.parse(sample.body));
		expect(res.cacheHit).toBe(true);
		expect(res.status).toBe(200);
		expect(res.fetchedAt).toBe('2026-10-30T08:30:00.000Z');
		expect(res.request.key).toBe(
			cacheKey('/search', { query: 'Bad Bunny', types: 'urn:entity:artist', take: 2 })
		);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('does not need an api key', () => {
		expect(() => replayClient(ok)).not.toThrow();
	});

	it('throws QlooReplayMissError for an uncached request', async () => {
		const client = replayClient(ok);
		const err = await client.search('Nobody Known', 'urn:entity:artist').catch((e) => e);
		expect(err).toBeInstanceOf(QlooReplayMissError);
		expect(err).toBeInstanceOf(QlooError);
		expect((err as QlooReplayMissError).request.endpoint).toBe('/search');
		expect((err as QlooReplayMissError).message).toContain('replay mode');
	});

	it('counts requests, cache hits and errors', async () => {
		const client = replayClient(ok);
		await client.search('Bad Bunny', 'urn:entity:artist', { take: 2 });
		await expect(client.search('Nobody Known', 'urn:entity:artist')).rejects.toThrow();
		expect(client.stats).toEqual({ requests: 2, cacheHits: 1, liveCalls: 0, errors: 1 });
	});

	it('replays recorded error responses as QlooError with the status', async () => {
		const client = replayClient(samples.filter((s) => s.id === 'compare.artist-vs-city'));
		const err = await client
			.compare({
				'a.signal.interests.entities': 'BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3',
				'b.signal.location.query': 'Guatemala City, Guatemala',
				take: 10
			})
			.catch((e) => e);
		expect(err).toBeInstanceOf(QlooError);
		expect((err as QlooError).status).toBe(400);
		expect((err as QlooError).message).toContain('b.signal.interests.entities is required');
	});

	it('documents the key collision: the 401 sample shadows the 200 one when both are seeded', async () => {
		const client = replayClient(samples);
		const err = await client.search('Bad Bunny', 'urn:entity:artist', { take: 2 }).catch((e) => e);
		expect((err as QlooError).status).toBe(401);
	});
});

describe('live mode', () => {
	it('requires an api key', () => {
		expect(() => new QlooClient({ mode: 'live' })).toThrow(/apiKey/);
		expect(() => new QlooClient({ mode: 'refresh' })).toThrow(/apiKey/);
		expect(() => new QlooClient()).toThrow(/apiKey/);
	});

	it('fetches on a miss, stores the entry, then serves the repeat from cache', async () => {
		const fetchImpl = mockFetch(() => jsonResponse(searchBody));
		const { client, store } = liveClient(fetchImpl);
		const first = await client.search('Bad Bunny', 'urn:entity:artist', { take: 2 });
		expect(first.cacheHit).toBe(false);
		expect(first.data.results[0].name).toBe('Bad Bunny');
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		const stored = await store.get(first.request.key);
		expect(stored).toMatchObject({
			key: first.request.key,
			endpoint: '/search',
			status: 200,
			body: searchBody,
			params: { query: 'Bad Bunny', take: '2', types: 'urn:entity:artist' }
		});
		expect(stored?.apiKeyFingerprint).toMatch(/^[0-9a-f]{6}$/);
		expect(JSON.stringify(stored)).not.toContain('test-key');

		const second = await client.search('Bad Bunny', 'urn:entity:artist', { take: 2 });
		expect(second.cacheHit).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(client.stats).toEqual({ requests: 2, cacheHits: 1, liveCalls: 1, errors: 0 });
	});

	it('reads from the persistent store when the in-memory layer is empty', async () => {
		const fetchImpl = mockFetch(() => jsonResponse(searchBody));
		const { client, store } = liveClient(fetchImpl);
		await client.search('Bad Bunny', 'urn:entity:artist');
		const other = new QlooClient({ apiKey: 'test-key', store, fetchImpl });
		const res = await other.search('Bad Bunny', 'urn:entity:artist');
		expect(res.cacheHit).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('refresh mode fetches even when cached and overwrites the entry', async () => {
		let n = 0;
		const fetchImpl = mockFetch(() =>
			jsonResponse({ results: [{ name: `v${++n}`, entity_id: 'abc' }] })
		);
		const store = new MemoryCacheStore();
		const live = new QlooClient({ apiKey: 'k', store, fetchImpl });
		await live.search('x', 'urn:entity:artist');
		const refresh = new QlooClient({ apiKey: 'k', store, fetchImpl, mode: 'refresh' });
		const a = await refresh.search('x', 'urn:entity:artist');
		const b = await refresh.search('x', 'urn:entity:artist');
		expect(fetchImpl).toHaveBeenCalledTimes(3);
		expect(a.cacheHit).toBe(false);
		expect(b.cacheHit).toBe(false);
		expect((await store.get(a.request.key))?.body).toEqual({
			results: [{ name: 'v3', entity_id: 'abc' }]
		});
	});

	it('sends the X-Api-Key header and the sorted query string', async () => {
		const fetchImpl = mockFetch(() => jsonResponse(searchBody));
		const { client } = liveClient(fetchImpl, { baseUrl: 'https://example.test/' });
		await client.search('Bad Bunny', 'urn:entity:artist', { take: 2 });
		const [url, init] = fetchImpl.mock.calls[0];
		expect(String(url)).toBe(
			'https://example.test/search?query=Bad+Bunny&take=2&types=urn%3Aentity%3Aartist'
		);
		const headers = init?.headers as Record<string, string>;
		expect(headers['X-Api-Key']).toBe('test-key');
		expect(headers.accept).toBe('application/json');
	});

	it('calls onRequest once per request with the right cacheHit', async () => {
		const events: QlooRequestEvent[] = [];
		const fetchImpl = mockFetch(() => jsonResponse(searchBody));
		const { client } = liveClient(fetchImpl, { onRequest: (e) => events.push(e) });
		await client.search('Bad Bunny', 'urn:entity:artist');
		await client.search('Bad Bunny', 'urn:entity:artist');
		await client.search('Other', 'urn:entity:artist');
		expect(events.map((e) => e.cacheHit)).toEqual([false, true, false]);
		expect(events.every((e) => e.status === 200 && e.error === undefined)).toBe(true);
		expect(events[0].endpoint).toBe('/search');
		expect(events[0].key).toBe(
			cacheKey('/search', { query: 'Bad Bunny', types: 'urn:entity:artist', take: 5 })
		);
	});
});

describe('errors', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('throws QlooError for a 400 with the message and caches it', async () => {
		const events: QlooRequestEvent[] = [];
		const fetchImpl = mockFetch(() =>
			jsonResponse({ errors: [{ message: 'filter.type is required' }] }, 400)
		);
		const { client, store } = liveClient(fetchImpl, { onRequest: (e) => events.push(e) });
		const err = await client.search('x', 'urn:entity:artist').catch((e) => e);
		expect(err).toBeInstanceOf(QlooError);
		expect((err as QlooError).status).toBe(400);
		expect((err as QlooError).message).toContain('filter.type is required');
		expect((err as QlooError).body).toEqual({ errors: [{ message: 'filter.type is required' }] });
		expect((await store.get((err as QlooError).request.key))?.status).toBe(400);
		expect(events[0].error).toBe('filter.type is required');

		const again = await client.search('x', 'urn:entity:artist').catch((e) => e);
		expect(again).toBeInstanceOf(QlooError);
		expect((again as QlooError).status).toBe(400);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(events.map((e) => e.cacheHit)).toEqual([false, true]);
		expect(client.stats.errors).toBe(2);
	});

	it('retries a 429 and succeeds', async () => {
		const responses = [
			() => jsonResponse({ message: 'slow down' }, 429),
			() => jsonResponse(searchBody)
		];
		const fetchImpl = vi.fn<typeof fetch>(async () => responses.shift()!());
		const { client, store } = liveClient(fetchImpl);
		const pending = client.search('x', 'urn:entity:artist');
		await vi.runAllTimersAsync();
		const res = await pending;
		expect(res.data.results).toHaveLength(1);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(res.cacheHit).toBe(false);
		expect((await store.get(res.request.key))?.status).toBe(200);
	});

	it('honors Retry-After on a 429', async () => {
		const responses = [
			() => jsonResponse({ message: 'slow' }, 429, { 'retry-after': '3' }),
			() => jsonResponse(searchBody)
		];
		const fetchImpl = vi.fn<typeof fetch>(async () => responses.shift()!());
		const { client } = liveClient(fetchImpl);
		const pending = client.search('x', 'urn:entity:artist');
		await vi.advanceTimersByTimeAsync(2900);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(200);
		await pending;
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('throws QlooError when a 500 persists past maxRetries and does not cache it', async () => {
		const fetchImpl = mockFetch(() => jsonResponse({ message: 'boom' }, 500));
		const { client, store } = liveClient(fetchImpl, { maxRetries: 1 });
		const pending = client.search('x', 'urn:entity:artist').catch((e) => e);
		await vi.runAllTimersAsync();
		const err = await pending;
		expect(err).toBeInstanceOf(QlooError);
		expect((err as QlooError).status).toBe(500);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(await store.get((err as QlooError).request.key)).toBeUndefined();
	});

	it('reports a QlooError with status 0 when fetch keeps failing', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => {
			throw new TypeError('network down');
		});
		const { client } = liveClient(fetchImpl, { maxRetries: 1 });
		const pending = client.search('x', 'urn:entity:artist').catch((e) => e);
		await vi.runAllTimersAsync();
		const err = await pending;
		expect(err).toBeInstanceOf(QlooError);
		expect((err as QlooError).status).toBe(0);
		expect((err as QlooError).message).toContain('network down');
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('throws QlooShapeError listing the issues when the body fails the schema', async () => {
		const fetchImpl = mockFetch(() => jsonResponse({ results: [{ entity_id: 5 }] }));
		const { client } = liveClient(fetchImpl);
		const err = await client.search('x', 'urn:entity:artist').catch((e) => e);
		expect(err).toBeInstanceOf(QlooShapeError);
		expect(err).toBeInstanceOf(QlooError);
		const issues = (err as QlooShapeError).issues;
		expect(issues.length).toBeGreaterThanOrEqual(2);
		expect(issues.some((i) => i.startsWith('results.0.name'))).toBe(true);
		expect(issues.some((i) => i.startsWith('results.0.entity_id'))).toBe(true);
		expect((err as QlooShapeError).body).toEqual({ results: [{ entity_id: 5 }] });
	});

	it('treats a non-JSON body as text', async () => {
		const fetchImpl = mockFetch(() => new Response('Not Found', { status: 404 }));
		const { client } = liveClient(fetchImpl);
		const err = await client.search('x', 'urn:entity:artist').catch((e) => e);
		expect((err as QlooError).status).toBe(404);
		expect((err as QlooError).body).toBe('Not Found');
		expect((err as QlooError).message).toContain('Not Found');
	});
});

describe('rate limiting', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('delays the third request when maxRequestsPerSecond is 2', async () => {
		const fetchImpl = mockFetch(() => jsonResponse(searchBody));
		const { client } = liveClient(fetchImpl, { maxRequestsPerSecond: 2 });
		const all = Promise.all([
			client.search('a', 'urn:entity:artist'),
			client.search('b', 'urn:entity:artist'),
			client.search('c', 'urn:entity:artist')
		]);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(999);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1000);
		expect(fetchImpl).toHaveBeenCalledTimes(3);
		await all;
	});
});

describe('typed helpers build the right params', () => {
	const emptyEntities = { results: { entities: [] } };

	it('insights sets filter.type', async () => {
		const fetchImpl = mockFetch(() => jsonResponse(emptyEntities));
		const { client } = liveClient(fetchImpl);
		const res = await client.insights('urn:entity:place', {
			'filter.location.query': 'Guatemala City, Guatemala',
			'signal.interests.entities': 'abc',
			take: 10
		});
		const url = calledUrl(fetchImpl);
		expect(url.pathname).toBe('/v2/insights');
		expect(url.searchParams.get('filter.type')).toBe('urn:entity:place');
		expect(url.searchParams.get('take')).toBe('10');
		expect(res.request.params['filter.type']).toBe('urn:entity:place');
	});

	it('insights overrides a conflicting filter.type', async () => {
		const fetchImpl = mockFetch(() => jsonResponse(emptyEntities));
		const { client } = liveClient(fetchImpl);
		await client.insights('urn:entity:artist', { 'filter.type': 'urn:entity:place' });
		expect(calledUrl(fetchImpl).searchParams.get('filter.type')).toBe('urn:entity:artist');
	});

	it('heatmapByLocality sets the locality boundary', async () => {
		const fetchImpl = mockFetch(() => jsonResponse(emptyEntities));
		const { client } = liveClient(fetchImpl);
		await client.heatmapByLocality({ 'filter.location.query': 'Mexico City, Mexico' });
		const url = calledUrl(fetchImpl);
		expect(url.searchParams.get('filter.type')).toBe('urn:heatmap');
		expect(url.searchParams.get('output.heatmap.boundary')).toBe('urn:entity:locality');
	});

	it('heatmap sends no boundary even if the caller passes one', async () => {
		const fetchImpl = mockFetch(() => jsonResponse({ results: { heatmap: [] } }));
		const { client } = liveClient(fetchImpl);
		await client.heatmap({
			'filter.location.query': 'Mexico City, Mexico',
			'output.heatmap.boundary': 'urn:entity:locality'
		});
		expect(calledUrl(fetchImpl).searchParams.has('output.heatmap.boundary')).toBe(false);
	});

	it('entities joins ids with a comma', async () => {
		const fetchImpl = mockFetch(() => jsonResponse({ results: [] }));
		const { client } = liveClient(fetchImpl);
		await client.entities(['a', 'b']);
		const url = calledUrl(fetchImpl);
		expect(url.pathname).toBe('/entities');
		expect(url.searchParams.get('entity_ids')).toBe('a,b');
	});

	it('heatmap rejects filter.price_level.min before any fetch', async () => {
		const fetchImpl = mockFetch(() => jsonResponse({ results: { heatmap: [] } }));
		const { client } = liveClient(fetchImpl);
		const err = await client.heatmap({ 'filter.price_level.min': 2 }).catch((e) => e);
		expect(err).toBeInstanceOf(QlooParamError);
		expect((err as QlooParamError).offending).toEqual(['filter.price_level.min']);
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(client.stats.liveCalls).toBe(0);
	});

	it('audiences and audienceTypes send take and the parent type', async () => {
		const fetchImpl = mockFetch(() =>
			jsonResponse({ results: { audiences: [], audience_types: [] } })
		);
		const { client } = liveClient(fetchImpl);
		await client.audiences('urn:audience:communities', 20);
		await client.audienceTypes();
		const first = calledUrl(fetchImpl, 0);
		expect(first.searchParams.get('filter.parents.types')).toBe('urn:audience:communities');
		expect(first.searchParams.get('take')).toBe('20');
		expect(calledUrl(fetchImpl, 1).pathname).toBe('/v2/audiences/types');
	});
});
