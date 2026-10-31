/**
 * Google sign-in through OpenID Connect (authorization code with PKCE, via arctic). The client
 * exists only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set; the redirect URI is the
 * public origin plus /auth/google/callback and must be registered on the OAuth client.
 */
import { Google } from 'arctic';
import { getEnv } from '../env.ts';

export const GOOGLE_SCOPES = ['openid', 'profile', 'email'];

export interface GoogleIdClaims {
	sub: string;
	email?: string;
	email_verified?: boolean;
	name?: string;
	picture?: string;
}

export function googleRedirectUri(requestOrigin: string): string {
	const base = getEnv().APP_BASE_URL ?? requestOrigin;
	return `${base.replace(/\/$/, '')}/auth/google/callback`;
}

export function googleClient(requestOrigin: string): Google | null {
	const env = getEnv();
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
	return new Google(
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		googleRedirectUri(requestOrigin)
	);
}
