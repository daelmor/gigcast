import { json, type RequestHandler } from '@sveltejs/kit';
import { createBriefRequestSchema, type ApiError } from '$lib/api/contracts';
import { creationGate } from '$lib/server/auth';
import { BriefBusyError, startBriefRun } from '$lib/server/briefs/manager';
import { countBriefsByUserSince, listRecentBriefs } from '$lib/server/briefs/store';
import { getEnv } from '$lib/server/env';

const bad = (status: number, error: string, details?: string[]) =>
	json({ error, details } satisfies ApiError, { status });

/** Forms send "" for untouched optional fields; treat those as absent at the top level. */
function stripEmptyStrings(body: unknown): unknown {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
	return Object.fromEntries(
		Object.entries(body as Record<string, unknown>).filter(([, v]) => v !== '' && v !== null)
	);
}

/** Start a brief run. Returns 201 with the id; the run continues in the background. */
export const POST: RequestHandler = async ({ request, locals }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return bad(400, 'The request body must be JSON.');
	}
	const parsed = createBriefRequestSchema.safeParse(stripEmptyStrings(body));
	if (!parsed.success) {
		return bad(
			400,
			'Invalid brief request.',
			parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
		);
	}
	if (parsed.data.dateTo < parsed.data.dateFrom) {
		return bad(400, 'Invalid brief request.', ['dateTo: must not be before dateFrom']);
	}
	// Reading briefs is public; creating one needs an account when AUTH_MODE=required, with a
	// rolling 24-hour limit per account so one sign-in cannot run up the agent budget.
	const env = getEnv();
	const user = locals.user;
	const briefsToday =
		env.AUTH_MODE === 'required' && user
			? await countBriefsByUserSince(user.id, new Date(Date.now() - 24 * 60 * 60 * 1000))
			: 0;
	const gate = creationGate({
		authMode: env.AUTH_MODE,
		signedIn: Boolean(user),
		briefsToday,
		dailyLimit: env.BRIEFS_PER_USER_PER_DAY
	});
	if (gate) return bad(gate.status, gate.error);
	try {
		const result = await startBriefRun(parsed.data, { userId: user?.id ?? null });
		locals.log.info(
			{ briefId: result.id, artist: parsed.data.artist, city: parsed.data.city },
			'brief started'
		);
		return json(result, { status: 201, headers: { location: `/brief/${result.id}` } });
	} catch (err) {
		if (err instanceof BriefBusyError) {
			return json(
				{
					error: 'The agent is busy with other briefs right now. Try again in a few minutes.'
				} satisfies ApiError,
				{ status: 429, headers: { 'retry-after': '120' } }
			);
		}
		throw err;
	}
};

/** Recent public briefs, newest first. */
export const GET: RequestHandler = async ({ url }) => {
	const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 12) || 12));
	return json({ briefs: await listRecentBriefs(limit) });
};
