/**
 * Authentication policy, pure functions: who may sign in, where to send them afterwards and
 * whether a brief may be created. Shared by the routes and the tests.
 */
export type AuthMode = 'off' | 'required';

/** "a@x.com, @n1co.com" -> ['a@x.com', '@n1co.com'] (lower-case, trimmed, empty entries dropped). */
export function parseAllowedEmails(raw: string | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

/** An empty list allows everyone; an entry starting with "@" allows the whole domain. */
export function isEmailAllowed(email: string, allowed: string[]): boolean {
	if (allowed.length === 0) return true;
	const e = email.trim().toLowerCase();
	const at = e.lastIndexOf('@');
	const domain = at >= 0 ? e.slice(at) : '';
	return allowed.some((a) => (a.startsWith('@') ? a === domain : a === e));
}

/** Only same-site paths are safe redirect targets after sign-in. */
export function safeNextPath(next: string | null | undefined, fallback = '/new'): string {
	if (!next) return fallback;
	if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
	if (/^\/auth\//.test(next)) return fallback;
	return next;
}

export interface CreationGateInput {
	authMode: AuthMode;
	signedIn: boolean;
	/** Briefs this user started in the last 24 hours. */
	briefsToday: number;
	dailyLimit: number;
}

/** Null when the brief may be created; otherwise the status and message to answer with. */
export function creationGate(
	input: CreationGateInput
): { status: 401 | 429; error: string } | null {
	if (input.authMode === 'off') return null;
	if (!input.signedIn) return { status: 401, error: 'Sign in to create a brief.' };
	if (input.briefsToday >= input.dailyLimit) {
		return {
			status: 429,
			error: `You have reached the limit of ${input.dailyLimit} brief${input.dailyLimit === 1 ? '' : 's'} in 24 hours. Try again tomorrow.`
		};
	}
	return null;
}
