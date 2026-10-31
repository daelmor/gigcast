import type { LayoutServerLoad } from './$types';
import { getEnv } from '$lib/server/env';

/** Who is signed in (null when nobody or when authentication is off) and whether creating briefs needs it. */
export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user,
	authMode: getEnv().AUTH_MODE
});
