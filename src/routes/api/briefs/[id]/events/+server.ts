/**
 * Server-sent events for a brief run. Replays the persisted events after
 * `Last-Event-ID` (or `?after=`), then follows the run live when it is
 * running on this instance, or by polling the database when it runs
 * elsewhere, and closes with a `done` event once the brief is terminal.
 */
import { error, type RequestHandler } from '@sveltejs/kit';
import type { BriefStatus } from '$lib/api/contracts';
import { getActiveRun, subscribe } from '$lib/server/briefs/manager';
import { getBriefHead, getEventsAfter } from '$lib/server/briefs/store';

const HEARTBEAT_MS = 15_000;
const POLL_MS = 2_000;
const isTerminal = (s: BriefStatus) => s === 'complete' || s === 'partial' || s === 'failed';

export const GET: RequestHandler = async ({ params, request, url, locals }) => {
	const id = params.id!;
	const head = await getBriefHead(id);
	if (!head) error(404, 'Brief not found');

	const fromHeader = request.headers.get('last-event-id');
	const fromQuery = url.searchParams.get('after');
	const after = Number(fromHeader ?? fromQuery ?? -1);
	let lastSeq = Number.isFinite(after) ? after : -1;

	const encoder = new TextEncoder();
	let closed = false;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let pollTimer: ReturnType<typeof setTimeout> | undefined;
	let unsubscribe: (() => void) | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const write = (chunk: string) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					close();
				}
			};
			const send = (event: string, data: unknown, seq?: number) =>
				write(
					`${seq !== undefined ? `id: ${seq}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
				);
			const close = () => {
				if (closed) return;
				closed = true;
				if (heartbeat) clearInterval(heartbeat);
				if (pollTimer) clearTimeout(pollTimer);
				unsubscribe?.();
				try {
					controller.close();
				} catch {
					// already closed by the client
				}
			};
			const finish = (status: BriefStatus) => {
				send('status', { status });
				send('done', { status });
				close();
			};
			const sendEvents = (events: { seq: number }[]) => {
				for (const e of events) {
					if (e.seq <= lastSeq) continue;
					send('agent', e, e.seq);
					lastSeq = e.seq;
				}
			};

			heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
			request.signal.addEventListener('abort', close);
			write(': connected\n\n');

			const follow = async () => {
				if (head.mainRunId) sendEvents(await getEventsAfter(head.mainRunId, lastSeq));
				if (isTerminal(head.status)) return finish(head.status);
				send('status', { status: head.status });

				const activeRun = getActiveRun(id);
				if (activeRun) {
					sendEvents(activeRun.events);
					unsubscribe = subscribe(id, (message) => {
						if (message.kind === 'event') sendEvents([message.event]);
						else if (message.done) finish(message.status);
						else send('status', { status: message.status });
					});
					// The run may have finished between the lookup and the subscription.
					if (!getActiveRun(id)) {
						const fresh = await getBriefHead(id);
						if (fresh && isTerminal(fresh.status)) {
							if (fresh.mainRunId) sendEvents(await getEventsAfter(fresh.mainRunId, lastSeq));
							finish(fresh.status);
						}
					}
					return;
				}

				// Running on another instance (or orphaned): poll the database.
				const poll = async () => {
					if (closed) return;
					const fresh = await getBriefHead(id);
					if (!fresh) return finish('failed');
					if (fresh.mainRunId) sendEvents(await getEventsAfter(fresh.mainRunId, lastSeq));
					if (isTerminal(fresh.status)) return finish(fresh.status);
					pollTimer = setTimeout(() => void poll().catch(onError), POLL_MS);
				};
				await poll();
			};
			const onError = (err: unknown) => {
				locals.log.error({ err, briefId: id }, 'event stream failed');
				send('status', { status: 'failed' });
				close();
			};
			void follow().catch(onError);
		},
		cancel() {
			closed = true;
			if (heartbeat) clearInterval(heartbeat);
			if (pollTimer) clearTimeout(pollTimer);
			unsubscribe?.();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
