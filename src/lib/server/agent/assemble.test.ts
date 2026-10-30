import { describe, expect, it } from 'vitest';
import {
	briefDraftSchema,
	briefSchema,
	type ArtistPick,
	type BriefDraft,
	type BriefInput
} from '../../brief/schema.ts';
import { sampleBrief } from '../../brief/fixtures/sample-brief.ts';
import { MemoryCacheStore } from '../qloo/cache.ts';
import { QlooClient } from '../qloo/client.ts';
import { cachedResponseFor, loadSamples, seedStore, type Sample } from '../qloo/test-support.ts';
import {
	assembleBrief,
	buildArtifacts,
	buildResolution,
	fallbackDraft,
	missingSections,
	verifyDraft
} from './assemble.ts';
import { createAgentTools, ToolRegistry, type ToolCallRecord } from './tools.ts';

const ARTIST_ID = 'BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3';
const LOCALITY_ID = '6A479AAF-1D8D-4EA2-AC1E-29B0906063AC';
const MADE_UP_ID = 'FFFFFFFF-0000-4000-8000-000000000001';

const input: BriefInput = {
	artist: 'Bad Bunny',
	city: 'Mexico City',
	country: 'MX',
	dateFrom: '2026-12-01',
	dateTo: '2026-12-03'
};

function sampleById(samples: Sample[], id: string): Sample {
	const found = samples.find((s) => s.id === id);
	if (!found) throw new Error(`missing sample ${id}`);
	return found;
}

function buildStore(): MemoryCacheStore {
	const samples = loadSamples().filter((s) => s.status === 200);
	const store = seedStore(samples);
	const auth = sampleById(samples, 'auth.hackathon');
	void store.set(cachedResponseFor({ ...auth, params: { ...auth.params, take: 5 } }));
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

/** Run the replay tools the brief depends on and return the registry they filled. */
async function runResearch(runPlaces = false) {
	const registry = new ToolRegistry(36);
	const client = new QlooClient({ mode: 'replay', store: buildStore() });
	const tools = createAgentTools({ client, registry });
	const run = async (name: string, raw: unknown, id: string) => {
		const tool = tools.find((t) => t.name === name);
		if (!tool) throw new Error(`no tool ${name}`);
		const parsed = tool.parse(raw);
		const toolUse = { id, name, input: parsed, type: 'tool_use' as const };
		await tool.run(parsed as never, { toolUse, toolUseBlock: toolUse } as never);
	};
	const artist_ids = [ARTIST_ID];
	await run('qloo_search_entity', { name: 'Bad Bunny' }, 'call_search');
	await run('qloo_similar_artists', { artist_ids, take: 10 }, 'call_similar');
	await run('qloo_brand_affinities', { artist_ids, take: 20 }, 'call_brands');
	await run('qloo_audience_demographics', { artist_ids }, 'call_demo');
	await run('qloo_artist_tags', { artist_ids, take: 20 }, 'call_tags');
	await run(
		'qloo_heatmap',
		{ artist_ids, locality_id: LOCALITY_ID, with_dimensions: true },
		'call_heat'
	);
	if (runPlaces) {
		await run('qloo_places_near', { artist_ids, lat: 19.43, lon: -99.13 }, 'call_places');
	}
	return registry;
}

function similarEntities(): Array<{ entity_id: string; name: string }> {
	const body = sampleById(loadSamples(), 'similar.anchor').body as {
		results: { entities: Array<{ entity_id: string; name: string }> };
	};
	return body.results.entities;
}

function artistPick(entityId: string, name: string, over: Partial<ArtistPick> = {}): ArtistPick {
	return {
		entityId,
		name,
		role: 'opener',
		affinity: 0.8,
		why: 'Test pick.',
		label: 'grounded',
		sources: [],
		...over
	};
}

function emptyHandRecord(
	toolCallId: string,
	tool: string,
	inputValue: unknown,
	artifacts: ToolCallRecord['artifacts'] = []
): ToolCallRecord {
	return {
		toolCallId,
		tool,
		input: inputValue,
		startedAt: '2026-10-30T00:00:00.000Z',
		ok: true,
		summary: '',
		requests: [],
		artifacts,
		entityIds: []
	};
}

describe('assembleBrief', () => {
	it('keeps grounded picks that Qloo returned and downgrades invented ones', async () => {
		const registry = await runResearch();
		const [real] = similarEntities();
		const draft = structuredClone(sampleBrief.draft);
		draft.lineup.picks = [
			artistPick(real.entity_id, real.name),
			artistPick(MADE_UP_ID, 'Totally Invented Band')
		];
		const expectedChecked =
			2 +
			draft.sponsors.picks.length +
			draft.venuesAndPartners.picks.length +
			(draft.risks?.items.length ?? 0);

		const brief = assembleBrief({
			id: 'brief_test',
			createdAt: '2026-10-30T12:00:00.000Z',
			input,
			draft,
			registry,
			run: sampleBrief.run
		});

		const [first, second] = brief.draft.lineup.picks;
		expect(first.label).toBe('grounded');
		expect(first.sources).toEqual(['call_similar']);
		expect(second.label).toBe('inferred');
		expect(second.sources).toEqual([]);
		expect(brief.verification.downgraded).toContainEqual(
			expect.objectContaining({ section: 'lineup', entityId: MADE_UP_ID })
		);
		expect(brief.verification.checked).toBe(expectedChecked);
	});

	it('produces a schema-valid brief with missingSections filled', async () => {
		const registry = await runResearch();
		const draft = structuredClone(sampleBrief.draft);
		draft.risks = undefined;
		const brief = assembleBrief({
			id: 'brief_test',
			createdAt: '2026-10-30T12:00:00.000Z',
			input,
			draft,
			registry,
			run: { ...sampleBrief.run, missingSections: [] }
		});
		expect(briefSchema.safeParse(brief).success).toBe(true);
		expect(brief.run.missingSections).toContain('risks');
		expect(brief.run.missingSections).toEqual(missingSections(brief.draft));
		expect(brief.id).toBe('brief_test');
	});

	it('drops hotspot sources that are not tool calls of this run', async () => {
		const registry = await runResearch();
		const draft = structuredClone(sampleBrief.draft);
		const hotspot = draft.audience.hotspots[0];
		hotspot.sources = ['call_heat', 'toolu_unknown'];
		verifyDraft(draft, registry);
		expect(hotspot.sources).toEqual(['call_heat']);
	});
});

describe('buildArtifacts', () => {
	it('collects the registry artifacts with their sources', async () => {
		const registry = await runResearch();
		const artifacts = buildArtifacts(registry);
		expect(artifacts.lineupCandidates?.items).toHaveLength(similarEntities().length);
		expect(artifacts.lineupCandidates?.source.toolCallId).toBe('call_similar');
		expect(artifacts.lineupCandidates?.source.cacheHit).toBe(true);
		expect(artifacts.heatmap?.hasDimensions).toBe(true);
		expect(artifacts.heatmap?.source.toolCallId).toBe('call_heat');
		expect(Object.keys(artifacts.demographics?.age ?? {})).toHaveLength(6);
		expect(artifacts.sponsorCandidates?.items.length).toBeGreaterThan(0);
		expect(artifacts.sponsorCandidates?.source.toolCallId).toBe('call_brands');
		expect(artifacts.artistTags?.items.length).toBeGreaterThan(0);
		expect(artifacts.placeCandidates).toBeUndefined();
	});
});

describe('buildResolution', () => {
	it('picks the search candidate whose id the tools used most', async () => {
		const registry = await runResearch();
		const { artist } = buildResolution(input, registry);
		expect(artist.entityId).toBe(ARTIST_ID);
		expect(artist.name).toBe('Bad Bunny');
	});

	it('falls back to the requested name when nothing was searched', () => {
		const { artist } = buildResolution(input, new ToolRegistry(5));
		expect(artist).toEqual({ entityId: 'unresolved', name: 'Bad Bunny', popularity: null });
	});

	it('uses entity_id when a locality was resolved', async () => {
		const registry = await runResearch();
		registry.calls.set(
			'call_locality',
			emptyHandRecord(
				'call_locality',
				'qloo_resolve_locality',
				{ city: 'Mexico City', country: 'MX' },
				[
					{
						kind: 'locality',
						resolution: {
							entityId: LOCALITY_ID,
							name: 'Mexico City',
							disambiguation: 'Mexico',
							lat: 19.43,
							lon: -99.13,
							query: 'Mexico City, Mexico',
							candidates: [],
							source: { endpoint: '/search', params: {}, key: '/search?x=1' }
						},
						candidates: [
							{
								entityId: LOCALITY_ID,
								name: 'Mexico City',
								disambiguation: 'Mexico',
								acceptable: true
							}
						] as never
					}
				]
			)
		);
		const { locality } = buildResolution(input, registry);
		expect(locality).toMatchObject({
			method: 'entity_id',
			entityId: LOCALITY_ID,
			name: 'Mexico City',
			lat: 19.43,
			lon: -99.13
		});
		expect(locality.candidates).toHaveLength(1);
	});

	it('uses point when a tool ran with coordinates and no locality artifact', async () => {
		const registry = await runResearch();
		registry.calls.set(
			'call_points',
			emptyHandRecord('call_points', 'qloo_places_near', { lat: 19.43, lon: -99.13 })
		);
		const { locality } = buildResolution(input, registry);
		expect(locality).toMatchObject({
			method: 'point',
			lat: 19.43,
			lon: -99.13,
			name: 'Mexico City'
		});
	});

	it('is unresolved without a locality or coordinates', async () => {
		const registry = await runResearch();
		const { locality } = buildResolution(input, registry);
		expect(locality.method).toBe('unresolved');
		expect(locality.name).toBe('Mexico City');
	});
});

describe('missingSections', () => {
	it('lists risks when the draft has none and lineup when picks are empty', () => {
		const draft: BriefDraft = structuredClone(sampleBrief.draft);
		draft.risks = undefined;
		draft.lineup.picks = [];
		const missing = missingSections(draft);
		expect(missing).toContain('risks');
		expect(missing).toContain('lineup');
	});

	it('lists nothing for a complete draft', () => {
		const draft = structuredClone(sampleBrief.draft);
		draft.risks = {
			note: { label: 'grounded', summary: 'Some risks.', caveats: [] },
			items: []
		} as never;
		expect(missingSections(draft)).toEqual([]);
	});
});

describe('fallbackDraft', () => {
	it('is a valid insufficient_data draft', () => {
		const draft = fallbackDraft('budget exhausted');
		const parsed = briefDraftSchema.parse(draft);
		expect(parsed.verdict).toBe('insufficient_data');
		expect(parsed.keyPoints).toEqual(['budget exhausted']);
		expect(missingSections(parsed)).toEqual(
			expect.arrayContaining(['audience', 'lineup', 'sponsors', 'pricing', 'risks'])
		);
	});
});

describe('buildResolution with a promoter-confirmed locality', () => {
	it('uses the confirmed locality id when the agent skipped qloo_resolve_locality', () => {
		const registry = new ToolRegistry(5);
		const hinted: BriefInput = {
			...input,
			localityEntityId: LOCALITY_ID,
			localityName: 'Ciudad de México'
		};
		const { locality } = buildResolution(hinted, registry);
		expect(locality.method).toBe('entity_id');
		expect(locality.entityId).toBe(LOCALITY_ID);
		expect(locality.name).toBe('Ciudad de México');
		expect(locality.disambiguation).toBe('confirmed by the promoter');
	});

	it('stays unresolved without a hint or a resolve call', () => {
		const { locality } = buildResolution(input, new ToolRegistry(5));
		expect(locality.method).toBe('unresolved');
	});
});
