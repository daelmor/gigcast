import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEnv, resetEnvCache } from './env';

const KEYS = [
	'QLOO_API_KEY',
	'DATABASE_URL',
	'GOOGLE_CLOUD_PROJECT',
	'INGEST_JOB_SECRET',
	'QLOO_BASE_URL',
	'ANTHROPIC_VERTEX_REGION'
] as const;

describe('getEnv', () => {
	const saved: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const k of KEYS) saved[k] = process.env[k];
		resetEnvCache();
		process.env.DATABASE_URL = 'postgres://example/db';
		process.env.GOOGLE_CLOUD_PROJECT = 'example-project';
		process.env.INGEST_JOB_SECRET = 'example-secret';
		delete process.env.QLOO_API_KEY;
		delete process.env.QLOO_BASE_URL;
		delete process.env.ANTHROPIC_VERTEX_REGION;
	});

	afterEach(() => {
		for (const k of KEYS) {
			if (saved[k] === undefined) delete process.env[k];
			else process.env[k] = saved[k];
		}
		resetEnvCache();
	});

	it('throws naming QLOO_API_KEY when it is missing', () => {
		expect(() => getEnv()).toThrow(/QLOO_API_KEY/);
	});

	it('applies defaults', () => {
		process.env.QLOO_API_KEY = 'example-key';
		const env = getEnv();
		expect(env.QLOO_BASE_URL).toBe('https://hackathon.api.qloo.com');
		expect(env.ANTHROPIC_VERTEX_REGION).toBe('global');
	});
});
