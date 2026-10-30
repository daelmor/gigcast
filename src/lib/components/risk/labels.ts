import type { RISK_CATEGORIES, TIME_HORIZONS } from '$lib/brief/schema';

export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export type TimeHorizon = (typeof TIME_HORIZONS)[number];

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
	security: 'Security',
	weather_climate: 'Weather & climate',
	political_unrest_elections: 'Politics & elections',
	economic_shock: 'Economy',
	health: 'Health',
	venue_infrastructure: 'Venue & infrastructure',
	artist_controversy: 'Artist controversy',
	competing_events: 'Competing events',
	permits_regulation: 'Permits & regulation',
	transport: 'Transport',
	other: 'Other'
};

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
	past: 'Past',
	ongoing: 'Ongoing',
	in_window: 'In your window',
	after_window: 'After your window',
	unknown: 'Timing unknown'
};

/** Tailwind classes per category: one color family each. */
export const RISK_CATEGORY_STYLES: Record<RiskCategory, string> = {
	security: 'bg-rose-50 text-rose-800 ring-rose-600/25',
	weather_climate: 'bg-sky-50 text-sky-800 ring-sky-600/25',
	political_unrest_elections: 'bg-purple-50 text-purple-800 ring-purple-600/25',
	economic_shock: 'bg-amber-50 text-amber-900 ring-amber-600/25',
	health: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
	venue_infrastructure: 'bg-orange-50 text-orange-800 ring-orange-600/25',
	artist_controversy: 'bg-pink-50 text-pink-800 ring-pink-600/25',
	competing_events: 'bg-indigo-50 text-indigo-800 ring-indigo-600/25',
	permits_regulation: 'bg-teal-50 text-teal-800 ring-teal-600/25',
	transport: 'bg-cyan-50 text-cyan-800 ring-cyan-600/25',
	other: 'bg-zinc-100 text-zinc-700 ring-zinc-500/25'
};

export function categoryLabel(category: string): string {
	return (RISK_CATEGORY_LABELS as Record<string, string>)[category] ?? category.replace(/_/g, ' ');
}

export function categoryStyle(category: string): string {
	return (RISK_CATEGORY_STYLES as Record<string, string>)[category] ?? RISK_CATEGORY_STYLES.other;
}

export function riskLevelWord(value: number): 'quiet' | 'watch' | 'loud' {
	return value < 25 ? 'quiet' : value < 60 ? 'watch' : 'loud';
}
