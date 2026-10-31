import { describe, expect, it } from 'vitest';
import {
	briefIdFromPath,
	clientIp,
	isBot,
	referrerHost,
	shouldRecord,
	visitorId
} from './record.ts';

describe('shouldRecord', () => {
	it('keeps pages and API calls, drops assets and the health check', () => {
		expect(shouldRecord('/')).toBe(true);
		expect(shouldRecord('/brief/brief_abc')).toBe(true);
		expect(shouldRecord('/api/briefs')).toBe(true);
		expect(shouldRecord('/dump.sql')).toBe(true);
		expect(shouldRecord('/api/health')).toBe(false);
		expect(shouldRecord('/_app/immutable/chunks/x.js')).toBe(false);
		expect(shouldRecord('/brand/gigcast-mark.svg')).toBe(false);
		expect(shouldRecord('/favicon.ico')).toBe(false);
		expect(shouldRecord('/og.png')).toBe(false);
	});
});

describe('isBot', () => {
	it('flags crawlers, scanners, scripts and missing user agents', () => {
		expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
		expect(isBot('curl/8.7.1')).toBe(true);
		expect(isBot('python-requests/2.32')).toBe(true);
		expect(isBot(null)).toBe(true);
		expect(
			isBot(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
			)
		).toBe(false);
	});
});

describe('visitorId', () => {
	it('is stable within a day, changes with the day and never contains the address', () => {
		const a = visitorId('203.0.113.9', 'UA', 'salt', '2026-10-31');
		expect(a).toHaveLength(16);
		expect(visitorId('203.0.113.9', 'UA', 'salt', '2026-10-31')).toBe(a);
		expect(visitorId('203.0.113.9', 'UA', 'salt', '2026-11-01')).not.toBe(a);
		expect(visitorId('203.0.113.9', 'UA', 'other', '2026-10-31')).not.toBe(a);
		expect(a).not.toContain('203');
		expect(visitorId(null, 'UA', 'salt')).toBeNull();
	});
});

describe('clientIp', () => {
	it('prefers the first forwarded hop and survives a missing address', () => {
		expect(
			clientIp(new Headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }), () => '10.0.0.2')
		).toBe('198.51.100.4');
		expect(clientIp(new Headers(), () => '10.0.0.2')).toBe('10.0.0.2');
		expect(
			clientIp(new Headers(), () => {
				throw new Error('no address');
			})
		).toBeNull();
	});
});

describe('referrerHost and briefIdFromPath', () => {
	it('keeps outside hosts only and reads brief ids from page and API paths', () => {
		expect(referrerHost('https://news.ycombinator.com/item?id=1', 'gigcast.ai')).toBe(
			'news.ycombinator.com'
		);
		expect(referrerHost('https://gigcast.ai/new', 'gigcast.ai')).toBeNull();
		expect(referrerHost('not a url', 'gigcast.ai')).toBeNull();
		expect(briefIdFromPath('/brief/brief_Ab1-_x/markdown')).toBe('brief_Ab1-_x');
		expect(briefIdFromPath('/api/briefs/brief_Ab1/events')).toBe('brief_Ab1');
		expect(briefIdFromPath('/api/briefs')).toBeNull();
	});
});
