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

export function categoryLabel(category: string): string {
	return (RISK_CATEGORY_LABELS as Record<string, string>)[category] ?? category.replace(/_/g, ' ');
}

export function riskLevelWord(value: number): 'quiet' | 'watch' | 'loud' {
	return value < 25 ? 'quiet' : value < 60 ? 'watch' : 'loud';
}
