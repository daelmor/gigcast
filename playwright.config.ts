import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the production build with the fake agent
 * runner, so they need no Qloo key and no Vertex access, only the local
 * Postgres from `pnpm db:start`. Briefs created by the tests land in that
 * database.
 */
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://gigcast:gigcast@localhost:5432/gigcast';

export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	timeout: 120_000,
	expect: { timeout: 15_000 },
	retries: process.env.CI ? 1 : 0,
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	webServer: {
		command: 'pnpm build && pnpm preview --port 4173 --strictPort',
		port: 4173,
		timeout: 240_000,
		reuseExistingServer: false,
		env: {
			AGENT_RUNNER: 'fake',
			FAKE_RUNNER_STEP_MS: '400',
			QLOO_API_KEY: 'e2e-placeholder',
			QLOO_BASE_URL: 'https://hackathon.api.qloo.com',
			QLOO_MODE: 'replay',
			QLOO_CACHE_BACKEND: 'file',
			QLOO_CACHE_DIR: '.cache/qloo-e2e',
			DATABASE_URL: databaseUrl,
			GOOGLE_CLOUD_PROJECT: 'e2e',
			MIGRATE_ON_START: 'true',
			LOG_LEVEL: 'warn'
		}
	}
});
