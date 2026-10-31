import { redirect, type RequestHandler } from '@sveltejs/kit';
import { decodeIdToken } from 'arctic';
import {
	createSession,
	googleClient,
	isEmailAllowed,
	parseAllowedEmails,
	safeNextPath,
	setSessionCookie,
	upsertGoogleUser,
	type GoogleIdClaims
} from '$lib/server/auth';
import { getEnv } from '$lib/server/env';

const TRANSIENT = ['gc_oauth_state', 'gc_oauth_verifier', 'gc_auth_next'];

/** Finishes Google sign-in: checks state, exchanges the code, reads the ID token, opens a session. */
export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('gc_oauth_state');
	const verifier = cookies.get('gc_oauth_verifier');
	const next = safeNextPath(cookies.get('gc_auth_next'));
	for (const name of TRANSIENT) cookies.delete(name, { path: '/' });

	if (!code || !state || !storedState || !verifier || state !== storedState) {
		locals.log.warn('google sign-in: state mismatch or missing code');
		redirect(303, '/new?auth=failed');
	}
	const google = googleClient(url.origin);
	if (!google) redirect(303, '/new?auth=unconfigured');

	let claims: GoogleIdClaims | undefined;
	try {
		const tokens = await google.validateAuthorizationCode(code, verifier);
		claims = decodeIdToken(tokens.idToken()) as GoogleIdClaims;
	} catch (err) {
		locals.log.warn(
			{ err: err instanceof Error ? err.message : String(err) },
			'google sign-in failed'
		);
	}
	if (!claims?.sub || !claims.email || claims.email_verified === false) {
		redirect(303, '/new?auth=failed');
	}
	if (!isEmailAllowed(claims.email, parseAllowedEmails(getEnv().AUTH_ALLOWED_EMAILS))) {
		locals.log.info({ email: claims.email }, 'google sign-in: email not allowed');
		redirect(303, '/new?auth=denied');
	}
	const user = await upsertGoogleUser({
		sub: claims.sub,
		email: claims.email,
		name: claims.name,
		picture: claims.picture
	});
	const { token, expiresAt } = await createSession(user.id);
	setSessionCookie(cookies, token, expiresAt);
	locals.log.info({ userId: user.id }, 'signed in');
	redirect(303, next);
};
