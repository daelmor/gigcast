import { redirect, type RequestHandler } from '@sveltejs/kit';
import { generateCodeVerifier, generateState } from 'arctic';
import { dev } from '$app/environment';
import { GOOGLE_SCOPES, googleClient, safeNextPath } from '$lib/server/auth';
import { getEnv } from '$lib/server/env';

const TEN_MINUTES = 600;

/** Starts Google sign-in: state and PKCE verifier in short-lived cookies, then off to Google. */
export const GET: RequestHandler = ({ url, cookies }) => {
	if (getEnv().AUTH_MODE === 'off') redirect(303, '/');
	const google = googleClient(url.origin);
	if (!google) redirect(303, '/new?auth=unconfigured');
	const state = generateState();
	const verifier = generateCodeVerifier();
	const options = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: !dev,
		maxAge: TEN_MINUTES
	};
	cookies.set('gc_oauth_state', state, options);
	cookies.set('gc_oauth_verifier', verifier, options);
	cookies.set('gc_auth_next', safeNextPath(url.searchParams.get('next')), options);
	redirect(302, google.createAuthorizationURL(state, verifier, GOOGLE_SCOPES).toString());
};
