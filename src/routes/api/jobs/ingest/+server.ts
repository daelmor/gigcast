/**
 * POST /api/jobs/ingest: refresh the news store for one market (`?market=slug`)
 * or for every market with outlets. Protected by a shared secret (Bearer).
 * Triggered on a schedule by the Container Apps job; safe to call by hand.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { KNOWN_MARKETS, findMarket } from '$lib/markets';
import { getEnv } from '$lib/server/env';
import { ingestMarket, type IngestSummary } from '$lib/server/risk';

function authorized(request: Request): boolean | null {
	const secret = getEnv().INGEST_JOB_SECRET;
	if (!secret) return null;
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
	if (token.length !== secret.length) return false;
	let diff = 0;
	for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
	return diff === 0;
}

export const POST: RequestHandler = async ({ request, url, locals }) => {
	const auth = authorized(request);
	if (auth === null)
		return json(
			{ error: 'Ingestion is not configured (INGEST_JOB_SECRET unset).' },
			{ status: 503 }
		);
	if (!auth) return json({ error: 'Unauthorized' }, { status: 401 });

	const slug = url.searchParams.get('market');
	const markets = slug
		? [findMarket(slug)].filter((m): m is NonNullable<typeof m> => Boolean(m))
		: KNOWN_MARKETS.filter((m) => m.featured);
	if (slug && markets.length === 0)
		return json({ error: `Unknown market ${slug}` }, { status: 404 });

	// Six markets with classification take several minutes, longer than the ingress allows a
	// request to live; run in the background and answer at once. `?wait=1` keeps the old
	// synchronous behaviour for manual checks of a single market.
	const log = locals.log;
	const run = async (): Promise<IngestSummary[]> => {
		const started = Date.now();
		const deadline = started + 20 * 60_000;
		const summaries: IngestSummary[] = [];
		for (const market of markets) {
			if (Date.now() > deadline) break;
			try {
				summaries.push(await ingestMarket(market, { budgetMs: 120_000 }));
			} catch (err) {
				log.error({ err, marketId: market.id }, 'ingestion failed');
				summaries.push({
					marketId: market.id,
					feedsTried: 0,
					feedsOk: 0,
					itemsSeen: 0,
					itemsNew: 0,
					classified: 0,
					errors: [err instanceof Error ? err.message : String(err)],
					durationMs: 0
				});
			}
		}
		log.info(
			{
				markets: summaries.map((s) => `${s.marketId}:${s.itemsNew}/${s.classified}`),
				durationMs: Date.now() - started
			},
			'ingest job finished'
		);
		return summaries;
	};

	if (url.searchParams.get('wait') === '1') {
		const summaries = await run();
		return json({ ok: true, markets: summaries });
	}
	if (ingestInFlight) {
		return json(
			{ ok: true, started: false, reason: 'an ingestion is already running' },
			{ status: 202 }
		);
	}
	ingestInFlight = run().finally(() => {
		ingestInFlight = undefined;
	});
	log.info({ markets: markets.map((m) => m.id) }, 'ingest job started');
	return json({ ok: true, started: true, markets: markets.map((m) => m.id) }, { status: 202 });
};

let ingestInFlight: Promise<IngestSummary[]> | undefined;
