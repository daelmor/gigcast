import { error, type RequestHandler } from '@sveltejs/kit';
import { getBriefRecord } from '$lib/server/briefs/store';

/** The brief as Markdown, for download or copy-paste into a deck. */
export const GET: RequestHandler = async ({ params, url }) => {
	const record = await getBriefRecord(params.id!);
	if (!record) error(404, 'Brief not found');
	if (!record.markdown) error(409, 'The brief is not finished yet');
	const download = url.searchParams.has('download');
	return new Response(record.markdown, {
		headers: {
			'content-type': 'text/markdown; charset=utf-8',
			...(download ? { 'content-disposition': `attachment; filename="${record.id}.md"` } : {})
		}
	});
};
