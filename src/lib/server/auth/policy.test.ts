import { describe, expect, it } from 'vitest';
import { creationGate, isEmailAllowed, parseAllowedEmails, safeNextPath } from './policy.ts';

describe('allowed emails', () => {
	it('parses a comma list and matches emails or domains', () => {
		const allowed = parseAllowedEmails(' David@Example.com, @n1co.com ,, ');
		expect(allowed).toEqual(['david@example.com', '@n1co.com']);
		expect(isEmailAllowed('david@example.com', allowed)).toBe(true);
		expect(isEmailAllowed('Someone@N1CO.com', allowed)).toBe(true);
		expect(isEmailAllowed('other@example.com', allowed)).toBe(false);
	});
	it('allows everyone when the list is empty', () => {
		expect(isEmailAllowed('anyone@anywhere.org', parseAllowedEmails(undefined))).toBe(true);
	});
});

describe('safeNextPath', () => {
	it('accepts same-site paths and rejects everything else', () => {
		expect(safeNextPath('/new?market=tampa')).toBe('/new?market=tampa');
		expect(safeNextPath('https://evil.example')).toBe('/new');
		expect(safeNextPath('//evil.example')).toBe('/new');
		expect(safeNextPath('/auth/google')).toBe('/new');
		expect(safeNextPath(null, '/')).toBe('/');
	});
});

describe('creationGate', () => {
	it('lets everything through when authentication is off', () => {
		expect(
			creationGate({ authMode: 'off', signedIn: false, briefsToday: 99, dailyLimit: 10 })
		).toBeNull();
	});
	it('asks for sign-in, then enforces the daily limit', () => {
		expect(
			creationGate({ authMode: 'required', signedIn: false, briefsToday: 0, dailyLimit: 10 })
		).toEqual({ status: 401, error: 'Sign in to create a brief.' });
		expect(
			creationGate({ authMode: 'required', signedIn: true, briefsToday: 10, dailyLimit: 10 })
				?.status
		).toBe(429);
		expect(
			creationGate({ authMode: 'required', signedIn: true, briefsToday: 3, dailyLimit: 10 })
		).toBeNull();
	});
});
