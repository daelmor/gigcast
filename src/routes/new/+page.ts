import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => ({
	market: url.searchParams.get('market'),
	artist: url.searchParams.get('artist')
});
