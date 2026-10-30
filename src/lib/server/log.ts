import pino from 'pino';

// Logs go to stderr so CLI output on stdout stays clean; Cloud Run captures both streams.
export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, pino.destination(2));
