import { redirect, type RequestHandler } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	invalidateSession,
	sessionIdFromToken
} from '$lib/server/auth';

/** Ends the session. A form POST from the header; SvelteKit already rejects cross-origin form posts. */
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });
	const token = cookies.get(SESSION_COOKIE);
	if (token) await invalidateSession(sessionIdFromToken(token));
	deleteSessionCookie(cookies);
	redirect(303, '/');
};
