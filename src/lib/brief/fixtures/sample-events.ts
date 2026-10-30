import type { AgentEvent } from '../events';

const RUN_ID = 'run_01JRUNSAMPLE0001';
const ARTIST_ID = 'CA98034C-6AD8-44AA-898E-038495C4E116';
const LOCALITY_ID = '3E843C82-ACFE-48BB-9C76-FC9A2781530D';
const T0 = Date.parse('2026-10-30T14:02:00.000Z');

let seq = 0;
let clock = T0;

function at(advanceMs: number): string {
	clock += advanceMs;
	return new Date(clock).toISOString();
}

function started(toolCallId: string, tool: string, input: unknown): AgentEvent {
	return {
		seq: seq++,
		at: at(400),
		runId: RUN_ID,
		type: 'tool_call.started',
		toolCallId,
		tool,
		input
	};
}

function finished(
	toolCallId: string,
	tool: string,
	summary: string,
	durationMs: number,
	requests: { endpoint: string; requestKey: string; cacheHit: boolean }[],
	ok = true
): AgentEvent {
	return {
		seq: seq++,
		at: at(durationMs),
		runId: RUN_ID,
		type: 'tool_call.finished',
		toolCallId,
		tool,
		ok,
		summary,
		cacheHit: requests.length > 0 && requests.every((r) => r.cacheHit),
		durationMs,
		requests
	};
}

const req = (query: string, cacheHit = false) => ({
	endpoint: '/v2/insights',
	requestKey: `/v2/insights?${query}`,
	cacheHit
});

export const sampleEvents: AgentEvent[] = [
	{
		seq: seq++,
		at: at(0),
		runId: RUN_ID,
		type: 'run.started',
		model: 'claude-sonnet-5-5',
		kind: 'main'
	},
	started('toolu_01A', 'qloo_heatmap', {
		artistEntityId: ARTIST_ID,
		localityEntityId: LOCALITY_ID,
		take: 1000
	}),
	finished(
		'toolu_01A',
		'qloo_heatmap',
		'855 heatmap cells, price-level dimensions available',
		1840,
		[
			req(
				`filter.location=${LOCALITY_ID}&filter.type=urn%3Aheatmap&signal.interests.entities=${ARTIST_ID}`
			)
		]
	),
	started('toolu_01B', 'qloo_audience_demographics', { entityId: ARTIST_ID }),
	finished(
		'toolu_01B',
		'qloo_audience_demographics',
		'6 age buckets, 2 gender values (cache hit)',
		95,
		[req(`filter.type=urn%3Ademographics&signal.interests.entities=${ARTIST_ID}`, true)]
	),
	started('toolu_01C', 'qloo_trending', { entityId: ARTIST_ID, take: 3 }),
	finished('toolu_01C', 'qloo_trending', '3 weekly points, latest percentile 0.93', 1210, [
		req(`filter.type=urn%3Aentity%3Aartist&signal.interests.entities=${ARTIST_ID}&take=3`)
	]),
	{
		seq: seq++,
		at: at(300),
		runId: RUN_ID,
		type: 'assistant.text',
		text: 'The heatmap concentrates around Zona 10 and Zona 4. Next I will compare the artist tags with the city tags and look for lineup candidates.'
	},
	started('toolu_01D', 'qloo_city_taste', { localityEntityId: LOCALITY_ID, take: 10 }),
	finished('toolu_01D', 'qloo_city_taste', '10 city tags', 1020, [
		req(`filter.type=urn%3Atag&signal.location=${LOCALITY_ID}&take=10`)
	]),
	started('toolu_01E', 'qloo_artist_tags', { entityId: ARTIST_ID, take: 10 }),
	finished('toolu_01E', 'qloo_artist_tags', '10 artist tags (cache hit)', 88, [
		req(`filter.type=urn%3Atag&signal.interests.entities=${ARTIST_ID}&take=10`, true)
	]),
	{ seq: seq++, at: at(50), runId: RUN_ID, type: 'section.ready', section: 'audience' },
	{ seq: seq++, at: at(20), runId: RUN_ID, type: 'section.ready', section: 'demandAndFit' },
	started('toolu_01F', 'qloo_similar_artists', {
		entityId: ARTIST_ID,
		localityEntityId: LOCALITY_ID,
		take: 10
	}),
	finished('toolu_01F', 'qloo_similar_artists', '10 similar artists with explainability', 1480, [
		req(`filter.type=urn%3Aentity%3Aartist&signal.interests.entities=${ARTIST_ID}&take=10`)
	]),
	started('toolu_01G', 'qloo_brand_affinities', {
		entityId: ARTIST_ID,
		localityEntityId: LOCALITY_ID,
		take: 20
	}),
	finished('toolu_01G', 'qloo_brand_affinities', '20 brands, top: Adidas (0.91)', 1330, [
		req(
			`filter.type=urn%3Aentity%3Abrand&signal.interests.entities=${ARTIST_ID}&signal.location=${LOCALITY_ID}&take=20`
		)
	]),
	started('toolu_01H', 'qloo_places_near', {
		entityId: ARTIST_ID,
		localityEntityId: LOCALITY_ID,
		kind: 'bar',
		take: 50
	}),
	finished('toolu_01H', 'qloo_places_near', '50 bars near the locality', 1760, [
		req(
			`filter.type=urn%3Aentity%3Aplace&filter.location=${LOCALITY_ID}&filter.tags=urn%3Atag%3Agenre%3Aplace%3Abar&take=50`
		)
	]),
	started('toolu_01I', 'qloo_places_near', {
		entityId: ARTIST_ID,
		localityEntityId: LOCALITY_ID,
		kind: 'hotel',
		take: 50
	}),
	finished('toolu_01I', 'qloo_places_near', '50 hotels near the locality (cache hit)', 110, [
		req(
			`filter.type=urn%3Aentity%3Aplace&filter.location=${LOCALITY_ID}&filter.tags=urn%3Atag%3Agenre%3Aplace%3Ahotel&take=50`,
			true
		)
	]),
	{ seq: seq++, at: at(40), runId: RUN_ID, type: 'section.ready', section: 'lineup' },
	{ seq: seq++, at: at(10), runId: RUN_ID, type: 'section.ready', section: 'sponsors' },
	{ seq: seq++, at: at(10), runId: RUN_ID, type: 'section.ready', section: 'venuesAndPartners' },
	{ seq: seq++, at: at(10), runId: RUN_ID, type: 'section.ready', section: 'pricing' },
	{
		seq: seq++,
		at: at(2200),
		runId: RUN_ID,
		type: 'brief.complete',
		briefId: 'brief_01JBRIEFSAMPLE0001',
		status: 'partial'
	}
];
