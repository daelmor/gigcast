/**
 * Risk items must cite a url the risk feed returned. The calendar and climate the agent reads
 * through market_calendar (Nager.Date, Open-Meteo) belong in the risk note and the Context card;
 * when the model emits them as items anyway they are not an error to report, just the wrong
 * place. Pure helpers shared by the assembler (new runs) and the read-time pass (stored briefs).
 */
import type { RiskItem } from './schema';

/** Hosts of the deterministic context sources behind market_calendar. */
export const CALENDAR_SOURCE_HOSTS = ['open-meteo.com', 'date.nager.at'] as const;

export const CALENDAR_ITEM_REASON =
	'calendar and climate context is shown in the Context card, not as a risk item';

/** Normalize a url for matching a cited source against the feed (scheme, host case, trailing slash). */
export function urlKey(url: string): string {
	try {
		const u = new URL(url);
		u.hash = '';
		return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`;
	} catch {
		return url.trim();
	}
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
	} catch {
		return '';
	}
}

export function isCalendarSourceUrl(url: string): boolean {
	const host = hostOf(url);
	return CALENDAR_SOURCE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Url keys of every item and advisory a risk feed returned. */
export function feedUrlKeys(
	feed: { items: { url: string }[]; advisories: { url: string }[] } | undefined
): Set<string> {
	const known = new Set<string>();
	if (!feed) return known;
	for (const i of feed.items) known.add(urlKey(i.url));
	for (const a of feed.advisories) known.add(urlKey(a.url));
	return known;
}

/**
 * An item is calendar context, not a risk, when its url is not from the feed and it either
 * points at a calendar or climate source or is a weather item. `known` undefined means no feed
 * was recorded with the brief; then only the source hosts decide, so a weather headline from a
 * newspaper is kept.
 */
export function isCalendarContextItem(item: RiskItem, known: Set<string> | undefined): boolean {
	if (known?.has(urlKey(item.sourceUrl))) return false;
	if (isCalendarSourceUrl(item.sourceUrl)) return true;
	return known !== undefined && item.category === 'weather_climate';
}

export function splitCalendarRiskItems(
	items: readonly RiskItem[],
	known: Set<string> | undefined
): { kept: RiskItem[]; dropped: RiskItem[] } {
	const kept: RiskItem[] = [];
	const dropped: RiskItem[] = [];
	for (const item of items) (isCalendarContextItem(item, known) ? dropped : kept).push(item);
	return { kept, dropped };
}
