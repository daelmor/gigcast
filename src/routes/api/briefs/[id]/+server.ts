import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getBriefRecord } from '$lib/server/briefs/store';

/** The stored brief: status, input, the assembled document once finished, runs and events. */
export const GET: RequestHandler = async ({ params }) => {
	const record = await getBriefRecord(params.id!);
	if (!record) error(404, 'Brief not found');
	return json(record, {
		headers: {
			'cache-control':
				record.status === 'complete' || record.status === 'partial' || record.status === 'failed'
					? 'public, max-age=60'
					: 'no-store'
		}
	});
};
