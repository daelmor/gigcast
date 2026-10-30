/**
 * Minimal RSS 2.0 / Atom reader for the risk layer. Fetches with a timeout and
 * a polite user agent, parses with fast-xml-parser and returns normalized
 * items. Headlines, snippets, links and dates only; never article bodies.
 */
import { XMLParser } from 'fast-xml-parser';

export interface FeedItem {
	title: string;
	link: string;
	snippet: string | null;
	publishedAt: string | null;
	/** Outlet name when the feed states it (Google News puts it in <source>). */
	source: string | null;
}

export interface FeedResult {
	url: string;
	ok: boolean;
	status: number;
	items: FeedItem[];
	error?: string;
	fetchedAt: string;
}

const USER_AGENT = 'gigcast/0.1 (+https://github.com/daelmor/gigcast; risk layer, headlines only)';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	cdataPropName: '__cdata',
	textNodeName: '#text',
	trimValues: true,
	parseTagValue: false
});

type Loose = Record<string, unknown>;

function text(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === 'string') return value.trim() || null;
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value)) return text(value[0]);
	if (typeof value === 'object') {
		const v = value as Loose;
		return text(v.__cdata ?? v['#text'] ?? null);
	}
	return null;
}

function stripHtml(html: string | null): string | null {
	if (!html) return null;
	const plain = html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/\s+/g, ' ')
		.trim();
	return plain ? plain.slice(0, 500) : null;
}

function isoDate(value: string | null): string | null {
	if (!value) return null;
	const t = Date.parse(value);
	return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function atomLink(entry: Loose): string | null {
	const link = entry.link;
	const links = Array.isArray(link) ? link : link ? [link] : [];
	let fallback: string | null = null;
	for (const l of links) {
		if (typeof l === 'string') return l;
		const obj = l as Loose;
		const href = text(obj['@_href']);
		if (!href) continue;
		if (!obj['@_rel'] || obj['@_rel'] === 'alternate') return href;
		fallback ??= href;
	}
	return fallback;
}

/** Parse an RSS or Atom document into items. Tolerant: unknown shapes yield no items, not errors. */
export function parseFeed(xml: string): FeedItem[] {
	let doc: Loose;
	try {
		doc = parser.parse(xml) as Loose;
	} catch {
		return [];
	}
	const rss = doc.rss as Loose | undefined;
	const channel = rss?.channel as Loose | undefined;
	const feed = doc.feed as Loose | undefined;
	const out: FeedItem[] = [];

	const rawItems = channel?.item ?? (doc['rdf:RDF'] as Loose | undefined)?.item;
	if (rawItems) {
		for (const raw of Array.isArray(rawItems) ? rawItems : [rawItems]) {
			const item = raw as Loose;
			const title = text(item.title);
			const link = text(item.link) ?? text(item.guid);
			if (!title || !link || !/^https?:\/\//.test(link)) continue;
			const sourceNode = item.source;
			const source =
				typeof sourceNode === 'object' && sourceNode
					? text((sourceNode as Loose)['#text'] ?? (sourceNode as Loose).__cdata)
					: text(sourceNode);
			out.push({
				title: stripHtml(title) ?? title,
				link,
				snippet: stripHtml(text(item.description) ?? text(item['content:encoded'])),
				publishedAt: isoDate(text(item.pubDate) ?? text(item['dc:date'])),
				source
			});
		}
	}
	if (feed?.entry) {
		const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
		for (const raw of entries) {
			const entry = raw as Loose;
			const title = text(entry.title);
			const link = atomLink(entry);
			if (!title || !link) continue;
			out.push({
				title: stripHtml(title) ?? title,
				link,
				snippet: stripHtml(text(entry.summary) ?? text(entry.content)),
				publishedAt: isoDate(text(entry.updated) ?? text(entry.published)),
				source: text((feed.title as unknown) ?? null)
			});
		}
	}
	return out;
}

export interface FetchFeedOptions {
	timeoutMs?: number;
	fetchImpl?: typeof fetch;
}

export async function fetchFeed(url: string, options: FetchFeedOptions = {}): Promise<FeedResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const fetchedAt = new Date().toISOString();
	try {
		const res = await fetchImpl(url, {
			headers: {
				'user-agent': USER_AGENT,
				accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
			},
			signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
			redirect: 'follow'
		});
		const body = await res.text();
		if (!res.ok)
			return {
				url,
				ok: false,
				status: res.status,
				items: [],
				error: `HTTP ${res.status}`,
				fetchedAt
			};
		const items = parseFeed(body);
		return { url, ok: true, status: res.status, items, fetchedAt };
	} catch (err) {
		return {
			url,
			ok: false,
			status: 0,
			items: [],
			error: err instanceof Error ? err.message : String(err),
			fetchedAt
		};
	}
}
