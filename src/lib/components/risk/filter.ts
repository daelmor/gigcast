import type { ClassifiedNews } from '$lib/brief/schema';
import type { RiskCategory } from './labels';

export interface FeedFilterState {
	/** Empty means every category. */
	categories: RiskCategory[];
	minSeverity: number;
	/** Only items published within this many days; 0 disables the window. */
	days: number;
	mentionsSubjectOnly: boolean;
}

export const DEFAULT_FILTERS: FeedFilterState = {
	categories: [],
	minSeverity: 1,
	days: 60,
	mentionsSubjectOnly: false
};

export const DAY_OPTIONS = [7, 30, 60] as const;

const DAY_MS = 86_400_000;

/** Filters items without mutating the input. Items without a date pass the days window. */
export function filterItems(
	items: readonly ClassifiedNews[],
	filters: FeedFilterState,
	now: number = Date.now()
): ClassifiedNews[] {
	const cutoff = filters.days > 0 ? now - filters.days * DAY_MS : null;
	return items.filter((item) => {
		if (filters.categories.length > 0 && !filters.categories.includes(item.category)) return false;
		if (item.severity < filters.minSeverity) return false;
		if (filters.mentionsSubjectOnly && !item.mentionsSubject) return false;
		if (cutoff !== null && item.publishedAt) {
			const t = Date.parse(item.publishedAt);
			if (Number.isFinite(t) && t < cutoff) return false;
		}
		return true;
	});
}
