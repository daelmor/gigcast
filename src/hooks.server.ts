/**
 * Server hooks: load the local env file in development, run migrations and
 * seed the known markets on start, attach a request id and a child logger to
 * every request, and log API requests as structured JSON.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { building, dev } from '$app/environment';
import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { activeRunCount } from '$lib/server/briefs/manager';
import { failOrphanedRuns, upsertKnownMarkets } from '$lib/server/briefs/store';
import { getDb } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { logger } from '$lib/server/log';

if (!building && dev) {
	const envFile = path.resolve(process.cwd(), '.env');
	// Node never overrides variables that are already set, so a real environment wins.
	if (existsSync(envFile)) process.loadEnvFile?.(envFile);
}

export const init: ServerInit = async () => {
	if (building) return;
	const env = getEnv();
	if (env.MIGRATE_ON_START) {
		await migrate(getDb(), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
		logger.info('migrations applied');
	}
	try {
		await upsertKnownMarkets();
		const orphaned = await failOrphanedRuns('The server restarted while this brief was running.');
		if (orphaned) logger.warn({ orphaned }, 'marked orphaned runs as failed');
	} catch (err) {
		// The app can still serve pages; the first request that needs the database will surface the error.
		logger.error({ err }, 'database warm-up failed');
	}
	// On SIGTERM the Node adapter stops accepting connections and keeps the process alive for
	// SHUTDOWN_TIMEOUT seconds (600 on Azure), so in-flight briefs finish and persist; viewers on
	// the new replica follow them through the database. Aborting here would throw their work away.
	process.once('SIGTERM', () =>
		logger.warn({ activeRuns: activeRunCount() }, 'SIGTERM: letting active runs finish')
	);
};

export const handle: Handle = async ({ event, resolve }) => {
	const requestId =
		event.request.headers.get('x-request-id') ??
		event.request.headers.get('x-cloud-trace-context')?.split('/')[0] ??
		crypto.randomUUID();
	event.locals.requestId = requestId;
	event.locals.log = logger.child({ requestId });
	const started = performance.now();
	const response = await resolve(event);
	response.headers.set('x-request-id', requestId);
	if (event.url.pathname.startsWith('/api/') || response.status >= 400) {
		event.locals.log.info(
			{
				method: event.request.method,
				path: event.url.pathname,
				status: response.status,
				durationMs: Math.round(performance.now() - started)
			},
			'request'
		);
	}
	return response;
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const log = event.locals.log ?? logger;
	if (status >= 500) log.error({ err: error, path: event.url.pathname, status }, 'unhandled error');
	return {
		message: status >= 500 ? 'Something went wrong on our side.' : message,
		requestId: event.locals.requestId
	};
};
