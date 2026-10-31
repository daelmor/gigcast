/**
 * Database sessions behind an httpOnly cookie. The cookie holds a random token; the table
 * stores its SHA-256, so a database leak does not yield usable cookies. Sessions last 30 days
 * and are extended when used in their second half.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import { getDb } from '../db/index.ts';
import { sessions, users } from '../db/schema.ts';

export const SESSION_COOKIE = 'gigcast_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_WHEN_LEFT_MS = 15 * 24 * 60 * 60 * 1000;

export interface AuthUser {
	id: string;
	email: string;
	name: string | null;
	picture: string | null;
}

export interface SessionInfo {
	id: string;
	userId: string;
	expiresAt: Date;
}

export function generateSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

export function sessionIdFromToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_MS);
	await getDb()
		.insert(sessions)
		.values({ id: sessionIdFromToken(token), userId, expiresAt });
	return { token, expiresAt };
}

export async function validateSessionToken(
	token: string
): Promise<{ user: AuthUser; session: SessionInfo; renewed: boolean } | null> {
	const db = getDb();
	const id = sessionIdFromToken(token);
	const rows = await db
		.select({
			sessionId: sessions.id,
			expiresAt: sessions.expiresAt,
			userId: users.id,
			email: users.email,
			name: users.name,
			picture: users.picture
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	const now = Date.now();
	if (row.expiresAt.getTime() <= now) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	let expiresAt = row.expiresAt;
	let renewed = false;
	if (row.expiresAt.getTime() - now < RENEW_WHEN_LEFT_MS) {
		expiresAt = new Date(now + SESSION_MS);
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
		renewed = true;
	}
	return {
		user: { id: row.userId, email: row.email, name: row.name, picture: row.picture },
		session: { id: row.sessionId, userId: row.userId, expiresAt },
		renewed
	};
}

export async function invalidateSession(id: string): Promise<void> {
	await getDb().delete(sessions).where(eq(sessions.id, id));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
