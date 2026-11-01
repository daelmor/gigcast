/**
 * Turn the agent's draft plus the tool registry into the final Brief:
 * attach raw artifacts with their sources, resolve what the run used as
 * artist and locality, and verify every "grounded" pick against the entity
 * ids Qloo actually returned (downgrading to "inferred" when it cannot).
 */
import { dedupeNeighbourhoods } from '../../brief/neighbourhoods.ts';
import { CALENDAR_ITEM_REASON, splitCalendarRiskItems, urlKey } from '../../brief/risk-items.ts';
import {
	briefSchema,
	type Brief,
	type BriefArtifacts,
	type BriefDraft,
	type BriefInput,
	type Candidate,
	type Resolution,
	type RunSummary,
	type SourceRef,
	type Verification
} from '../../brief/schema.ts';
import { VERDICT_LABEL } from '../../brief/verdict.ts';
import type { ToolArtifact, ToolCallRecord, ToolRegistry } from './tools.ts';

export interface AssembleOptions {
	id: string;
	createdAt: string;
	input: BriefInput;
	draft: BriefDraft;
	registry: ToolRegistry;
	run: RunSummary;
}

function sourceRef(rec: ToolCallRecord): SourceRef {
	const first = rec.requests[0];
	return {
		tool: rec.tool,
		toolCallId: rec.toolCallId,
		endpoint: first?.endpoint ?? '',
		requestKey: first?.requestKey ?? '',
		cacheHit: rec.requests.length > 0 && rec.requests.every((r) => r.cacheHit),
		fetchedAt: first?.fetchedAt ?? rec.finishedAt ?? rec.startedAt
	};
}

type Picked<K extends ToolArtifact['kind']> = {
	rec: ToolCallRecord;
	artifact: Extract<ToolArtifact, { kind: K }>;
};

function artifactsOfKind<K extends ToolArtifact['kind']>(
	registry: ToolRegistry,
	kind: K
): Picked<K>[] {
	const out: Picked<K>[] = [];
	for (const rec of registry.calls.values()) {
		if (!rec.ok) continue;
		for (const artifact of rec.artifacts) {
			if (artifact.kind === kind)
				out.push({ rec, artifact: artifact as Extract<ToolArtifact, { kind: K }> });
		}
	}
	return out;
}

function largest<K extends ToolArtifact['kind']>(
	items: Picked<K>[],
	size: (a: Extract<ToolArtifact, { kind: K }>) => number
) {
	return items.reduce<Picked<K> | undefined>(
		(best, cur) => (!best || size(cur.artifact) > size(best.artifact) ? cur : best),
		undefined
	);
}

export function buildArtifacts(registry: ToolRegistry): BriefArtifacts {
	const artifacts: BriefArtifacts = {
		calls: [...registry.calls.values()].filter((r) => r.requests.length > 0).map(sourceRef)
	};

	const heat = largest(artifactsOfKind(registry, 'heatmap'), (a) => a.cells.length);
	if (heat)
		artifacts.heatmap = {
			cells: heat.artifact.cells,
			hasDimensions: heat.artifact.hasDimensions,
			source: sourceRef(heat.rec)
		};

	const hoods = largest(artifactsOfKind(registry, 'neighbourhoods'), (a) => a.items.length);
	// The same place comes back under several entities; keep one per name, highest affinity.
	if (hoods)
		artifacts.neighbourhoods = {
			items: dedupeNeighbourhoods(hoods.artifact.items),
			source: sourceRef(hoods.rec)
		};

	const demo = artifactsOfKind(registry, 'demographics')[0];
	if (demo)
		artifacts.demographics = {
			age: demo.artifact.age,
			gender: demo.artifact.gender,
			source: sourceRef(demo.rec)
		};

	const trend = largest(artifactsOfKind(registry, 'trending'), (a) => a.points.length);
	if (trend) artifacts.trending = { items: trend.artifact.points, source: sourceRef(trend.rec) };

	const tags = artifactsOfKind(registry, 'tags');
	const artistTags = largest(
		tags.filter((t) => t.artifact.purpose === 'artist'),
		(a) => a.items.length
	);
	if (artistTags)
		artifacts.artistTags = { items: artistTags.artifact.items, source: sourceRef(artistTags.rec) };
	const cityTags = largest(
		tags.filter((t) => t.artifact.purpose === 'city'),
		(a) => a.items.length
	);
	if (cityTags)
		artifacts.cityTags = { items: cityTags.artifact.items, source: sourceRef(cityTags.rec) };

	const artists = artifactsOfKind(registry, 'artists');
	const cityArtists = largest(
		artists.filter((a) => a.artifact.purpose === 'city'),
		(a) => a.items.length
	);
	if (cityArtists)
		artifacts.cityArtists = {
			items: cityArtists.artifact.items,
			source: sourceRef(cityArtists.rec)
		};
	const similar = largest(
		artists.filter((a) => a.artifact.purpose === 'similar'),
		(a) => a.items.length
	);
	if (similar)
		artifacts.lineupCandidates = { items: similar.artifact.items, source: sourceRef(similar.rec) };

	const brands = largest(artifactsOfKind(registry, 'brands'), (a) => a.items.length);
	if (brands)
		artifacts.sponsorCandidates = { items: brands.artifact.items, source: sourceRef(brands.rec) };

	const places = artifactsOfKind(registry, 'places');
	if (places.length) {
		artifacts.placeCandidates = places.map((p) => ({
			kind: p.artifact.category,
			items: p.artifact.items,
			source: sourceRef(p.rec)
		}));
	}

	const calendar = artifactsOfKind(registry, 'calendar')[0];
	if (calendar)
		artifacts.marketCalendar = { ...calendar.artifact.calendar, source: sourceRef(calendar.rec) };
	const risk = largest(artifactsOfKind(registry, 'risk'), (a) => a.feed.items.length);
	if (risk) artifacts.riskFeed = { ...risk.artifact.feed, source: sourceRef(risk.rec) };
	return artifacts;
}

/**
 * Risk items must cite a url the risk_feed tool returned (news item or advisory); others are
 * downgraded. Calendar and climate context the model emitted as items (Open-Meteo, Nager.Date,
 * weather with no feed url) is not an error to show: it leaves the list and is recorded here.
 */
export function verifyRiskItems(
	draft: BriefDraft,
	registry: ToolRegistry,
	verification: Verification
): void {
	if (!draft.risks || draft.risks.items.length === 0) return;
	// No feed recorded at all (risk_feed never ran): only the calendar hosts decide what is
	// context, and every grounded item is downgraded below as before.
	const feeds = artifactsOfKind(registry, 'risk');
	const known = feeds.length ? new Set<string>() : undefined;
	for (const picked of feeds) {
		for (const i of picked.artifact.feed.items) known?.add(urlKey(i.url));
		for (const a of picked.artifact.feed.advisories) known?.add(urlKey(a.url));
	}
	const { kept, dropped } = splitCalendarRiskItems(draft.risks.items, known);
	for (const item of dropped) {
		verification.checked++;
		verification.downgraded.push({
			section: 'risks',
			entityId: item.sourceUrl,
			name: item.title,
			reason: CALENDAR_ITEM_REASON
		});
	}
	draft.risks.items = kept;
	for (const item of kept) {
		verification.checked++;
		if (item.label === 'grounded' && !known?.has(urlKey(item.sourceUrl))) {
			item.label = 'inferred';
			verification.downgraded.push({
				section: 'risks',
				entityId: item.sourceUrl,
				name: item.title,
				reason: 'source url was not returned by the risk feed in this run'
			});
		}
	}
}

/** Which artist the run treated as the headliner: the id passed most often to the tools. */
function headlinerId(registry: ToolRegistry): string | undefined {
	const counts = new Map<string, number>();
	for (const rec of registry.calls.values()) {
		const input = rec.input as
			{ artist_ids?: unknown; artist_id?: unknown; artist_a_id?: unknown } | undefined;
		const ids: string[] = [];
		if (Array.isArray(input?.artist_ids))
			ids.push(...input.artist_ids.filter((x): x is string => typeof x === 'string'));
		if (typeof input?.artist_id === 'string') ids.push(input.artist_id);
		if (typeof input?.artist_a_id === 'string') ids.push(input.artist_a_id);
		for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	let best: string | undefined;
	let bestCount = 0;
	for (const [id, n] of counts) if (n > bestCount) [best, bestCount] = [id, n];
	return best;
}

export function buildResolution(input: BriefInput, registry: ToolRegistry): Resolution {
	const searches = artifactsOfKind(registry, 'search').flatMap((s) => s.artifact.items);
	const chosenId = headlinerId(registry);
	const chosen: Candidate | undefined =
		searches.find((c) => c.entityId === chosenId) ?? searches[0];
	const artist = chosen
		? { entityId: chosen.entityId, name: chosen.name, popularity: chosen.popularity ?? null }
		: { entityId: chosenId ?? 'unresolved', name: input.artist, popularity: null };

	const loc =
		artifactsOfKind(registry, 'locality').find((l) => l.artifact.resolution) ??
		artifactsOfKind(registry, 'locality')[0];
	const candidates = (loc?.artifact.candidates ?? []).map((c) => ({
		entityId: c.entityId,
		name: c.name,
		disambiguation: c.disambiguation,
		acceptable: c.acceptable
	}));
	if (loc?.artifact.resolution) {
		const r = loc.artifact.resolution;
		return {
			artist,
			locality: {
				method: 'entity_id',
				entityId: r.entityId,
				name: r.name,
				disambiguation: r.disambiguation,
				lat: r.lat,
				lon: r.lon,
				candidates
			}
		};
	}
	// The promoter confirmed the locality in the form and the agent skipped qloo_resolve_locality.
	if (input.localityEntityId) {
		const usedTheId = [...registry.calls.values()].some(
			(rec) =>
				(rec.input as { locality_id?: unknown } | undefined)?.locality_id === input.localityEntityId
		);
		return {
			artist,
			locality: {
				method: 'entity_id',
				entityId: input.localityEntityId,
				name: input.localityName ?? input.city,
				disambiguation: usedTheId
					? 'confirmed by the promoter and used by the tools'
					: 'confirmed by the promoter',
				candidates
			}
		};
	}
	// Did any tool run with coordinates instead?
	for (const rec of registry.calls.values()) {
		const i = rec.input as { lat?: unknown; lon?: unknown } | undefined;
		if (typeof i?.lat === 'number' && typeof i?.lon === 'number') {
			return {
				artist,
				locality: { method: 'point', lat: i.lat, lon: i.lon, name: input.city, candidates }
			};
		}
	}
	return { artist, locality: { method: 'unresolved', name: input.city, candidates } };
}

interface PickLike {
	entityId: string;
	name: string;
	label: 'grounded' | 'inferred' | 'no_coverage';
	sources: string[];
}

function verifyPicks(
	section: string,
	picks: PickLike[],
	registry: ToolRegistry,
	verification: Verification
): void {
	for (const pick of picks) {
		verification.checked++;
		const returnedBy = registry.toolCallsReturning(pick.entityId);
		// Keep only sources that exist in this run; add the calls that really returned the entity.
		const valid = pick.sources.filter((id) => registry.calls.has(id));
		pick.sources = [...new Set([...valid, ...returnedBy])];
		if (pick.label === 'grounded' && returnedBy.length === 0) {
			pick.label = 'inferred';
			verification.downgraded.push({
				section,
				entityId: pick.entityId,
				name: pick.name,
				reason: 'entity id was not returned by any tool call in this run'
			});
		}
	}
}

/** The sections a verdict needs; without them the only honest verdict is insufficient_data. */
export const VERDICT_CORE_SECTIONS = ['audience', 'lineup', 'sponsors'] as const;

/**
 * A verdict describes preliminary cultural fit. When a core section ended with no coverage the
 * model has nothing to judge it on, whatever it emitted; the guard forces insufficient_data and
 * records the change so the document can show it.
 */
export function enforceVerdict(draft: BriefDraft, verification: Verification): void {
	const missing = VERDICT_CORE_SECTIONS.filter((s) => draft[s].note.label === 'no_coverage');
	if (missing.length === 0 || draft.verdict === 'insufficient_data') return;
	verification.checked++;
	verification.downgraded.push({
		section: 'verdict',
		entityId: draft.verdict,
		name: VERDICT_LABEL[draft.verdict],
		reason: `the model emitted "${draft.verdict}" but ${missing.join(', ')} ended with no coverage; the verdict is insufficient_data`
	});
	draft.verdict = 'insufficient_data';
}

/** Verify grounded picks against the registry; mutates and returns the draft. */
export function verifyDraft(draft: BriefDraft, registry: ToolRegistry): Verification {
	const verification: Verification = { downgraded: [], checked: 0 };
	verifyRiskItems(draft, registry, verification);
	verifyPicks('lineup', draft.lineup.picks, registry, verification);
	verifyPicks('sponsors', draft.sponsors.picks, registry, verification);
	verifyPicks('venuesAndPartners', draft.venuesAndPartners.picks, registry, verification);
	for (const hotspot of draft.audience.hotspots) {
		hotspot.sources = hotspot.sources.filter((id) => registry.calls.has(id));
	}
	enforceVerdict(draft, verification);
	return verification;
}

export function missingSections(draft: BriefDraft): string[] {
	const out: string[] = [];
	if (draft.audience.note.label === 'no_coverage') out.push('audience');
	if (draft.demandAndFit.note.label === 'no_coverage') out.push('demandAndFit');
	if (draft.lineup.note.label === 'no_coverage' || draft.lineup.picks.length === 0)
		out.push('lineup');
	if (draft.sponsors.note.label === 'no_coverage' || draft.sponsors.picks.length === 0)
		out.push('sponsors');
	if (draft.venuesAndPartners.note.label === 'no_coverage') out.push('venuesAndPartners');
	if (draft.pricing.note.label === 'no_coverage' || draft.pricing.tiers.length === 0)
		out.push('pricing');
	if (!draft.risks || draft.risks.note.label === 'no_coverage') out.push('risks');
	return out;
}

export function assembleBrief(options: AssembleOptions): Brief {
	const { registry } = options;
	const verification = verifyDraft(options.draft, registry);
	const brief: Brief = {
		version: 1,
		id: options.id,
		createdAt: options.createdAt,
		input: options.input,
		resolution: buildResolution(options.input, registry),
		draft: options.draft,
		artifacts: buildArtifacts(registry),
		verification,
		run: { ...options.run, missingSections: missingSections(options.draft) }
	};
	return briefSchema.parse(brief);
}

/** A minimal but valid draft for runs that never reached emit_brief. */
export function fallbackDraft(reason: string): BriefDraft {
	const note = (summary: string) => ({
		label: 'no_coverage' as const,
		summary,
		caveats: [] as string[]
	});
	const missing = `This section was not delivered: ${reason}`;
	return {
		headline: 'Brief incomplete: the agent did not deliver a full brief',
		verdict: 'insufficient_data',
		keyPoints: [reason],
		audience: { note: note(missing), hotspots: [] },
		demandAndFit: { note: note(missing) },
		lineup: { note: note(missing), picks: [] },
		sponsors: { note: note(missing), picks: [] },
		venuesAndPartners: { note: note(missing), picks: [] },
		pricing: { note: note(missing), currency: 'USD', tiers: [], assumptions: [] },
		risks: { note: note('The risk layer is not available in this build.'), items: [] },
		openQuestions: ['Re-run the brief; the research data gathered so far is attached as artifacts.']
	};
}
