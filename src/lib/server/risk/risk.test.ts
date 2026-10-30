import { describe, expect, it } from 'vitest';
import { canonicalUrl, newsId, splitGoogleTitle, titleKey } from './canonical.ts';
import { longWeekends } from './calendar.ts';
import { parseFeed } from './rss.ts';
import { ageDays, decayWeight, riskScore, squash } from './score.ts';

describe('canonical urls and titles', () => {
	it('drops tracking parameters, the hash, www and the trailing slash', () => {
		expect(canonicalUrl('https://www.Example.com/a/b/?utm_source=x&id=2&fbclid=y#top')).toBe(
			'https://example.com/a/b?id=2'
		);
	});
	it('gives a stable id for the same canonical url', () => {
		expect(newsId(canonicalUrl('https://example.com/x?utm_medium=a'))).toBe(
			newsId(canonicalUrl('https://www.example.com/x/'))
		);
	});
	it('splits Google News titles into headline and outlet', () => {
		expect(splitGoogleTitle('Cierran la zona 10 por concierto - Prensa Libre')).toEqual({
			title: 'Cierran la zona 10 por concierto',
			source: 'Prensa Libre'
		});
		expect(splitGoogleTitle('Sin guion').source).toBeNull();
	});
	it('title keys ignore accents, case and the outlet suffix', () => {
		expect(titleKey('Concierto en Ciudad de Guatemala - Soy502')).toBe(
			titleKey('CONCIERTO EN CIUDAD DE GUATEMALA | Prensa Libre')
		);
	});
});

describe('parseFeed', () => {
	it('reads RSS 2.0 items with Google News source tags', () => {
		const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Google Noticias</title>
			<item><title>Noche de gigantes - Guatemala.com</title><link>https://news.google.com/rss/articles/abc</link>
			<pubDate>Wed, 29 Oct 2026 12:00:00 GMT</pubDate><description>&lt;a href="x"&gt;Resumen&lt;/a&gt; del concierto</description>
			<source url="https://guatemala.com">Guatemala.com</source></item></channel></rss>`;
		const items = parseFeed(xml);
		expect(items).toHaveLength(1);
		expect(items[0].link).toBe('https://news.google.com/rss/articles/abc');
		expect(items[0].source).toBe('Guatemala.com');
		expect(items[0].snippet).toBe('Resumen del concierto');
		expect(items[0].publishedAt).toBe('2026-10-29T12:00:00.000Z');
	});
	it('reads Atom entries with alternate links', () => {
		const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Guatemala travel advice</title>
			<entry><title>Latest update</title><link rel="alternate" href="https://www.gov.uk/foreign-travel-advice/guatemala"/>
			<updated>2026-10-01T09:00:00Z</updated><summary>Summary text</summary></entry></feed>`;
		const items = parseFeed(xml);
		expect(items).toHaveLength(1);
		expect(items[0].link).toBe('https://www.gov.uk/foreign-travel-advice/guatemala');
		expect(items[0].source).toBe('Guatemala travel advice');
	});
	it('returns no items for garbage', () => {
		expect(parseFeed('<html>nope</html>')).toEqual([]);
		expect(parseFeed('not xml at all <<<')).toEqual([]);
	});
});

describe('longWeekends', () => {
	it('finds a Friday holiday as a three-day weekend and flags the window', () => {
		// 2026-11-20 is a Friday.
		const out = longWeekends(
			['2026-11-20'],
			'2026-11-01',
			'2026-12-31',
			'2026-11-19',
			'2026-11-23'
		);
		expect(out).toEqual([
			{ start: '2026-11-20', end: '2026-11-22', days: 3, holidays: ['2026-11-20'], inWindow: true }
		]);
	});
	it('ignores midweek holidays and plain weekends', () => {
		// 2026-11-18 is a Wednesday.
		expect(
			longWeekends(['2026-11-18'], '2026-11-01', '2026-11-30', '2026-11-01', '2026-11-30')
		).toEqual([]);
	});
	it('bridges a Monday holiday after a weekend', () => {
		// 2026-11-23 is a Monday.
		const out = longWeekends(
			['2026-11-23'],
			'2026-11-01',
			'2026-11-30',
			'2026-12-01',
			'2026-12-02'
		);
		expect(out[0]).toMatchObject({
			start: '2026-11-21',
			end: '2026-11-23',
			days: 3,
			inWindow: false
		});
	});
});

describe('score', () => {
	const now = new Date('2026-10-30T00:00:00Z');
	it('decays with age and scales with severity and confidence', () => {
		expect(decayWeight(5, 1, 0)).toBe(1);
		expect(decayWeight(5, 1, 14)).toBe(0.5);
		expect(decayWeight(1, 1, 0)).toBe(0);
		expect(decayWeight(3, 1, 0)).toBe(0.354);
		expect(decayWeight(3, 0.5, 0)).toBe(0.177);
		expect(ageDays('2026-10-23T00:00:00Z', now)).toBe(7);
		expect(ageDays(null, now)).toBe(30);
	});
	it('squashes sums into 0..100 and counts recent items', () => {
		expect(squash(0)).toBe(0);
		expect(squash(4)).toBe(63);
		// A week of six fresh severity-2 items stays quiet; two fresh severity-4 items read as watch.
		expect(squash(6 * decayWeight(2, 0.8, 1))).toBeLessThan(25);
		expect(squash(2 * decayWeight(4, 0.8, 1))).toBeGreaterThanOrEqual(20);
		const score = riskScore(
			[
				{ category: 'security', weight: 0.8, publishedAt: '2026-10-29T00:00:00Z' },
				{ category: 'security', weight: 0.4, publishedAt: '2026-09-01T00:00:00Z' },
				{ category: 'transport', weight: 0.2, publishedAt: null }
			],
			now
		);
		expect(score.itemCount).toBe(3);
		expect(score.recentCount).toBe(1);
		expect(score.value).toBe(squash(1.4));
		expect(score.byCategory.security).toBe(squash(1.2));
		expect(score.byCategory.transport).toBe(squash(0.2));
	});
});
