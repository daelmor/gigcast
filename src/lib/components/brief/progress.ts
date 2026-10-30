import type { AgentEvent } from '$lib/brief/events';
import { BRIEF_SECTIONS, type BriefSection } from '$lib/brief/schema';

export type SectionState = 'pending' | 'in_progress' | 'ready';

/** Which tools feed which section. emit_brief starts pricing and risks. */
const FEEDS: Record<BriefSection, (tool: string) => boolean> = {
	audience: (t) => t.startsWith('qloo_heatmap') || t === 'qloo_resolve_locality',
	demandAndFit: (t) =>
		[
			'qloo_audience_demographics',
			'qloo_trending',
			'qloo_artist_tags',
			'qloo_city_taste',
			'qloo_compare'
		].includes(t),
	lineup: (t) => t === 'qloo_similar_artists',
	sponsors: (t) => t === 'qloo_brand_affinities',
	venuesAndPartners: (t) => t === 'qloo_places_near',
	pricing: (t) => t === 'emit_brief',
	risks: (t) => t === 'emit_brief'
};

export const SECTION_LABELS: Record<BriefSection, string> = {
	audience: 'Audience',
	demandAndFit: 'Demand and fit',
	lineup: 'Lineup',
	sponsors: 'Sponsors',
	venuesAndPartners: 'Venues',
	pricing: 'Pricing',
	risks: 'Risks'
};

export function sectionStates(events: AgentEvent[]): Record<BriefSection, SectionState> {
	const complete = events.some((e) => e.type === 'brief.complete');
	const ready = new Set<BriefSection>();
	const started = new Set<BriefSection>();
	for (const e of events) {
		if (e.type === 'section.ready') ready.add(e.section);
		if (e.type === 'tool_call.started') {
			for (const s of BRIEF_SECTIONS) if (FEEDS[s](e.tool)) started.add(s);
		}
	}
	const out = {} as Record<BriefSection, SectionState>;
	for (const s of BRIEF_SECTIONS) {
		out[s] = complete || ready.has(s) ? 'ready' : started.has(s) ? 'in_progress' : 'pending';
	}
	return out;
}
