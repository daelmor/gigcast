import { describe, expect, it, vi } from 'vitest';
import { briefDraftSchema } from '../../brief/schema.ts';
import { sampleBrief } from '../../brief/fixtures/sample-brief.ts';
import { MemoryCacheStore } from '../qloo/cache.ts';
import { QlooClient } from '../qloo/client.ts';
import { cachedResponseFor, loadSamples, seedStore, type Sample } from '../qloo/test-support.ts';
import { createAgentTools, QLOO_TOOL_NAMES, ToolRegistry, type ToolCallRecord } from './tools.ts';

const ARTIST_ID = 'BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3';
const LOCALITY_ID = '6A479AAF-1D8D-4EA2-AC1E-29B0906063AC';
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

function sampleById(samples: Sample[], id: string): Sample {
	const found = samples.find((s) => s.id === id);
	if (!found) throw new Error(`missing sample ${id}`);
	return found;
}

/** Replay store seeded from the recorded samples plus two synthetic entries. */
function buildStore(): MemoryCacheStore {
	const samples = loadSamples().filter((s) => s.status === 200);
	const store = seedStore(samples);
	// auth.hackathon recorded take=2; the tool asks for take=5.
	const auth = sampleById(samples, 'auth.hackathon');
	void store.set(cachedResponseFor({ ...auth, params: { ...auth.params, take: 5 } }));
	// heatmap.dimensions recorded filter.location.query; the tool sends filter.location=<id>.
	const heat = sampleById(samples, 'heatmap.dimensions');
	void store.set(
		cachedResponseFor({
			endpoint: '/v2/insights',
			params: {
				'filter.type': 'urn:heatmap',
				'filter.location': LOCALITY_ID,
				'signal.interests.entities': ARTIST_ID,
				'heatmap.dimensions': 'quality,popularity,price_level'
			},
			status: 200,
			body: heat.body
		})
	);
	return store;
}

function setup(maxToolCalls = 36, events: ConstructorParameters<typeof ToolRegistry>[1] = {}) {
	const registry = new ToolRegistry(maxToolCalls, events);
	const client = new QlooClient({ mode: 'replay', store: buildStore() });
	const tools = createAgentTools({
		client,
		registry,
		now: () => new Date('2026-10-30T00:00:00Z')
	});
	let n = 0;
	const byName = (name: string) => {
		const tool = tools.find((t) => t.name === name);
		if (!tool) throw new Error(`no tool ${name}`);
		return tool;
	};
	/** Parse then run a tool the way the tool runner would. */
	const call = async (name: string, raw: unknown, id = `toolu_${++n}`) => {
		const tool = byName(name);
		const input = tool.parse(raw);
		const toolUse = { id, name, input, type: 'tool_use' as const };
		const out = await tool.run(input as never, { toolUse, toolUseBlock: toolUse } as never);
		return { id, json: JSON.parse(out as string) as Record<string, unknown> };
	};
	return { registry, tools, call, byName };
}

function sampleEntityCount(sample: Sample): number {
	return (sample.body as { results: { entities: unknown[] } }).results.entities.length;
}

const rec = (registry: ToolRegistry, id: string): ToolCallRecord => {
	const r = registry.calls.get(id);
	if (!r) throw new Error(`no record ${id}`);
	return r;
};

describe('tool list', () => {
	it('exposes the Qloo tools plus emit_brief in a stable order', () => {
		const { tools } = setup();
		expect(tools.map((t) => t.name)).toEqual([...QLOO_TOOL_NAMES, 'emit_brief']);
	});

	it('enables eager input streaming on every tool', () => {
		const { tools } = setup();
		for (const tool of tools) {
			expect((tool as { eager_input_streaming?: boolean }).eager_input_streaming).toBe(true);
		}
	});
});

describe('qloo_search_entity', () => {
	it('returns candidates and records the call', async () => {
		const { registry, call } = setup();
		const { id, json } = await call('qloo_search_entity', { name: 'Bad Bunny' }, 'toolu_search');
		expect(id).toBe('toolu_search');
		expect(json.toolCallId).toBe('toolu_search');
		const candidates = json.candidates as Array<{ id: string; name: string; popularity: number }>;
		expect(json.count).toBe(candidates.length);
		expect(candidates.length).toBeGreaterThan(0);
		expect(candidates[0].id).toBe(ARTIST_ID);
		expect(candidates[0].name).toBe('Bad Bunny');
		expect(typeof candidates[0].popularity).toBe('number');

		const r = rec(registry, 'toolu_search');
		expect(r.ok).toBe(true);
		expect(r.requests).toHaveLength(1);
		expect(r.requests[0].cacheHit).toBe(true);
		expect(r.entityIds).toEqual(candidates.map((c) => c.id));
		expect(r.artifacts.map((a) => a.kind)).toEqual(['search']);
	});
});

describe('qloo_similar_artists', () => {
	it('hits the similar.anchor sample', async () => {
		const { registry, call } = setup();
		const { id, json } = await call('qloo_similar_artists', { artist_ids: [ARTIST_ID], take: 10 });
		const artists = json.artists as Array<{ id: string; explain?: Record<string, number> }>;
		// The recorded sample is truncated to 3 entities (the live request asked for 10).
		const expected = sampleEntityCount(sampleById(loadSamples(), 'similar.anchor'));
		expect(expected).toBeGreaterThan(0);
		expect(json.count).toBe(expected);
		expect(artists).toHaveLength(expected);
		for (const a of artists) {
			expect(typeof a.explain).toBe('object');
			expect(Object.keys(a.explain ?? {}).length).toBeGreaterThan(0);
		}
		const r = rec(registry, id);
		expect(r.ok).toBe(true);
		expect(r.summary).toContain('(cache)');
		expect(r.artifacts).toHaveLength(1);
		expect(r.artifacts[0]).toMatchObject({ kind: 'artists', purpose: 'similar' });
		expect(r.entityIds).toHaveLength(expected);
	});
});

describe('qloo_brand_affinities', () => {
	it('returns brands from the recorded sample', async () => {
		const { registry, call } = setup();
		const { id, json } = await call('qloo_brand_affinities', { artist_ids: [ARTIST_ID], take: 20 });
		const brands = json.brands as Array<{ id: string; name: string }>;
		expect(json.count).toBe(brands.length);
		expect(brands.length).toBeGreaterThan(0);
		expect(brands.map((b) => b.name)).toContain('Adidas');
		const r = rec(registry, id);
		expect(r.artifacts[0].kind).toBe('brands');
		expect(r.entityIds).toEqual(brands.map((b) => b.id));
		expect(r.summary).toContain('(cache)');
	});
});

describe('qloo_audience_demographics', () => {
	it('summarises age and gender', async () => {
		const { registry, call } = setup();
		const { id, json } = await call('qloo_audience_demographics', { artist_ids: [ARTIST_ID] });
		expect(json.topAgeBuckets).toHaveLength(2);
		expect(['male', 'female', 'balanced']).toContain(json.genderSkew);
		expect(Object.keys(json.age as object)).toHaveLength(6);
		const r = rec(registry, id);
		expect(r.artifacts[0]).toMatchObject({ kind: 'demographics' });
		expect(r.summary).toContain('top ages');
	});
});

describe('qloo_artist_tags', () => {
	it('returns tags with affinity', async () => {
		const { registry, call } = setup();
		const { id, json } = await call('qloo_artist_tags', { artist_ids: [ARTIST_ID], take: 20 });
		const tags = json.tags as Array<{ name: string; affinity?: number }>;
		expect(tags.length).toBeGreaterThan(0);
		expect(typeof tags[0].name).toBe('string');
		const artifact = rec(registry, id).artifacts[0];
		expect(artifact).toMatchObject({ kind: 'tags', purpose: 'artist' });
		if (artifact.kind === 'tags') expect(artifact.items).toHaveLength(tags.length);
	});
});

describe('qloo_heatmap', () => {
	it('summarises cells, hotspots and the price-level distribution', async () => {
		const heatSample = sampleById(loadSamples(), 'heatmap.dimensions');
		const expectedCells = (heatSample.body as { results: { heatmap: unknown[] } }).results.heatmap
			.length;
		const { registry, call } = setup();
		const { id, json } = await call('qloo_heatmap', {
			artist_ids: [ARTIST_ID],
			locality_id: LOCALITY_ID,
			with_dimensions: true
		});
		expect(json.cellCount).toBe(expectedCells);
		expect(json.hasDimensions).toBe(true);
		const hotspots = json.hotspots as Array<{ affinity: number }>;
		// Hotspots are the top 10 cells; the recorded sample only holds 3.
		expect(hotspots).toHaveLength(Math.min(10, expectedCells));
		for (let i = 1; i < hotspots.length; i++)
			expect(hotspots[i - 1].affinity).toBeGreaterThanOrEqual(hotspots[i].affinity);
		expect(typeof (json.priceLevelAffinity as { p50: unknown }).p50).toBe('number');

		const artifact = rec(registry, id).artifacts[0];
		expect(artifact.kind).toBe('heatmap');
		if (artifact.kind === 'heatmap') {
			expect(artifact.cells).toHaveLength(expectedCells);
			expect(artifact.hasDimensions).toBe(true);
			expect(artifact.cells[0]).toEqual(
				expect.objectContaining({
					geohash: expect.any(String),
					lat: expect.any(Number),
					lon: expect.any(Number),
					affinity: expect.any(Number),
					priceLevel: expect.any(Number)
				})
			);
		}
	});
});

describe('replay miss', () => {
	it('reports no_coverage and marks the record failed', async () => {
		const { registry, call } = setup();
		const { id, json } = await call('qloo_similar_artists', { artist_ids: [UNKNOWN_ID] });
		expect(json.no_coverage).toBe(true);
		expect(typeof json.error).toBe('string');
		expect(rec(registry, id).ok).toBe(false);
	});
});

describe('tool budget', () => {
	it('refuses a call that exceeds the budget, records it, and keeps counting', async () => {
		const onStarted = vi.fn();
		const onFinished = vi.fn();
		const { registry, call } = setup(2, { onStarted, onFinished });
		const input = { artist_ids: [ARTIST_ID] };
		await call('qloo_artist_tags', input);
		await call('qloo_artist_tags', input);
		const third = await call('qloo_artist_tags', input);
		expect(typeof third.json.error).toBe('string');
		expect(third.json.action).toMatch(/emit_brief/);
		expect(registry.count).toBe(3);
		expect(registry.remaining).toBe(0);
		// The refused call is still traced: started and finished (not ok), with no Qloo request.
		expect(onStarted).toHaveBeenCalledTimes(3);
		expect(onFinished).toHaveBeenCalledTimes(3);
		const refused = [...registry.calls.values()][2];
		expect(refused.ok).toBe(false);
		expect(refused.requests).toHaveLength(0);
	});
});

describe('emit_brief', () => {
	it('accepts a valid draft once and rejects a second call', async () => {
		const { registry, call } = setup();
		const first = await call('emit_brief', structuredClone(sampleBrief.draft), 'toolu_emit1');
		expect(first.json.ok).toBe(true);
		expect(registry.draft).toBeDefined();
		expect(registry.draftToolCallId).toBe('toolu_emit1');
		const kept = registry.draft;

		const second = await call('emit_brief', structuredClone(sampleBrief.draft), 'toolu_emit2');
		expect(typeof second.json.error).toBe('string');
		expect(registry.draft).toBe(kept);
		expect(registry.draftToolCallId).toBe('toolu_emit1');
		expect(registry.emitBriefCalls).toBe(2);
		expect(rec(registry, 'toolu_emit2').ok).toBe(false);
	});

	it('rejects a draft with an invalid label at parse time', () => {
		const { byName } = setup();
		const draft = structuredClone(sampleBrief.draft) as Record<string, unknown>;
		(draft.audience as { note: { label: string } }).note.label = 'definitely';
		expect(briefDraftSchema.safeParse(draft).success).toBe(false);
		expect(() => byName('emit_brief').parse(draft)).toThrow();
	});
});

describe('registry helpers', () => {
	it('totals and toolCallsReturning reflect the recorded calls', async () => {
		const { registry, call } = setup();
		const search = await call('qloo_search_entity', { name: 'Bad Bunny' }, 'toolu_s');
		await call('qloo_artist_tags', { artist_ids: [ARTIST_ID] }, 'toolu_t');
		await call('qloo_similar_artists', { artist_ids: [UNKNOWN_ID] });
		const [first] = search.json.candidates as Array<{ id: string }>;
		expect(registry.toolCallsReturning(first.id)).toEqual(['toolu_s']);
		expect(registry.toolCallsReturning('not-an-entity')).toEqual([]);
		expect(registry.totals()).toEqual({ toolCalls: 3, qlooCalls: 2, qlooCacheHits: 2 });
	});
});

describe('location filter', () => {
	it('qloo_places_near requires a locality or coordinates', async () => {
		const { registry, call } = setup();
		const { id, json } = await call('qloo_places_near', { artist_ids: [ARTIST_ID] });
		expect(String(json.error)).toContain('locality_id');
		const r = rec(registry, id);
		expect(r.ok).toBe(false);
		expect(r.requests).toHaveLength(0);
	});
});
