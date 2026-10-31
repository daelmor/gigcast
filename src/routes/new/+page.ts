import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => ({
	market: url.searchParams.get('market'),
	artist: url.searchParams.get('artist'),
	/** Outcome of a sign-in attempt that sent the person back here. */
	auth: url.searchParams.get('auth')
});
