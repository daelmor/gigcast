/**
 * What the activity log keeps about a request and what it leaves out.
 *
 * Kept: method, path without the query string, status, duration, a daily
 * rotating hash of the client address and user agent (counts visitors, never
 * identifies one), the user agent trimmed, the referrer's host, a bot flag
 * from the user agent, and the brief id when the path names one. Static
 * assets and the health check are not recorded.
 */
import { createHash, randomBytes } from 'node:crypto';
import { getEnv } from '../env.ts';

const ASSET_PATH =
	/^\/(?:_app\/|brand\/|fonts\/|favicon|apple-touch-icon|manifest\.webmanifest$|og\.png$)/;
const ASSET_EXT = /\.(?:png|jpe?g|gif|svg|ico|css|js|mjs|map|woff2?|ttf)$/i;
const SKIPPED = new Set(['/api/health']);

export function shouldRecord(pathname: string): boolean {
	return !SKIPPED.has(pathname) && !ASSET_PATH.test(pathname) && !ASSET_EXT.test(pathname);
}

const BOT_UA =
	/bot|crawl|spider|slurp|scan|nmap|masscan|zgrab|censys|nuclei|curl\/|wget\/|python|go-http-client|java\/|okhttp|libwww|httpclient|axios|node-fetch|undici|headless|phantom|puppeteer|playwright|lighthouse|pingdom|uptime|monitor/i;

/** A missing user agent counts as a bot: browsers always send one. */
export function isBot(userAgent: string | null | undefined): boolean {
	return !userAgent || BOT_UA.test(userAgent);
}

/** First hop of x-forwarded-for (the ingress sets it), else the adapter's address. */
export function clientIp(headers: Headers, fallback: () => string): string | null {
	const forwarded = headers.get('x-forwarded-for');
	if (forwarded) {
		const first = forwarded.split(',')[0]?.trim();
		if (first) return first;
	}
	try {
		return fallback() || null;
	} catch {
		return null;
	}
}

let processSalt: string | undefined;

/** ACTIVITY_SALT, or a random salt that lives as long as the process when the variable is unset. */
export function activitySalt(): string {
	const configured = getEnv().ACTIVITY_SALT;
	if (configured) return configured;
	processSalt ??= randomBytes(16).toString('hex');
	return processSalt;
}

/**
 * Sixteen hex characters of sha256(salt | day | address | user agent). The day in the hash
 * means the same visitor gets a new id every day, so the log can count visitors per day but
 * cannot follow one across days.
 */
export function visitorId(
	ip: string | null,
	userAgent: string | null | undefined,
	salt: string,
	day = new Date().toISOString().slice(0, 10)
): string | null {
	if (!ip) return null;
	return createHash('sha256')
		.update(`${salt}|${day}|${ip}|${userAgent ?? ''}`)
		.digest('hex')
		.slice(0, 16);
}

/** The referrer's host, or null when it is missing, malformed or the app itself. */
export function referrerHost(
	referrer: string | null,
	ownHost: string | null | undefined
): string | null {
	if (!referrer) return null;
	try {
		const host = new URL(referrer).host;
		return host && host !== ownHost ? host : null;
	} catch {
		return null;
	}
}

const BRIEF_PATH = /^\/(?:api\/)?briefs?\/(brief_[A-Za-z0-9_-]+)/;

export function briefIdFromPath(pathname: string): string | null {
	return BRIEF_PATH.exec(pathname)?.[1] ?? null;
}

export function trimUserAgent(userAgent: string | null | undefined): string | null {
	return userAgent ? userAgent.slice(0, 160) : null;
}
