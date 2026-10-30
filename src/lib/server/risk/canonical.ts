/**
 * URL and title normalization for deduplicating news items. Pure.
 */
import { createHash } from 'node:crypto';

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|igshid$|mc_cid$|mc_eid$|ref$|source$|oc$)/i;

/** Lower-case host, no hash, no tracking parameters, no trailing slash. */
export function canonicalUrl(raw: string): string {
	try {
		const u = new URL(raw.trim());
		u.hash = '';
		u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
		for (const key of [...u.searchParams.keys()]) {
			if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
		}
		u.searchParams.sort();
		if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
		return u.toString();
	} catch {
		return raw.trim();
	}
}

/** Stable id for a news item: sha256 of the canonical url. */
export function newsId(canonical: string): string {
	return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Title key for near-duplicate detection: accent-insensitive, lower-case,
 * alphanumeric words, outlet suffix after " - " or " | " removed.
 */
export function titleKey(title: string): string {
	return title
		.replace(/\s+[-|–—]\s+[^-|–—]{2,60}$/, '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Outlet suffix Google News appends to titles ("Headline - Outlet"). */
export function splitGoogleTitle(title: string): { title: string; source: string | null } {
	const m = title.match(/^(.*?)\s+-\s+([^-]{2,60})$/);
	if (!m) return { title: title.trim(), source: null };
	return { title: m[1].trim(), source: m[2].trim() };
}
