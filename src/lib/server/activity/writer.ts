/**
 * Buffered writer for the request log: rows are inserted in batches every
 * few seconds (or every fifty rows) off the request path, and a database
 * problem drops the batch with one warning a minute instead of failing a
 * request. Best effort by design.
 */
import { getDb } from '../db/index.ts';
import { requestLog, type NewRequestLogRow } from '../db/schema.ts';
import { logger } from '../log.ts';

const FLUSH_MS = 5_000;
const FLUSH_ROWS = 50;

let buffer: NewRequestLogRow[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let lastWarnAt = 0;

export function enqueueRequestLog(row: NewRequestLogRow): void {
	buffer.push(row);
	if (buffer.length >= FLUSH_ROWS) {
		void flushRequestLog();
		return;
	}
	if (!timer) {
		timer = setTimeout(() => void flushRequestLog(), FLUSH_MS);
		timer.unref?.();
	}
}

export async function flushRequestLog(): Promise<void> {
	if (timer) {
		clearTimeout(timer);
		timer = undefined;
	}
	const rows = buffer;
	buffer = [];
	if (!rows.length) return;
	try {
		await getDb().insert(requestLog).values(rows);
	} catch (err) {
		if (Date.now() - lastWarnAt > 60_000) {
			lastWarnAt = Date.now();
			logger.warn({ err, dropped: rows.length }, 'request log flush failed');
		}
	}
}

/** Rows waiting to be written; for tests and the shutdown log line. */
export function pendingRequestLogRows(): number {
	return buffer.length;
}
