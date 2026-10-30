/**
 * Browser-side subscription to a brief's SSE stream. Keeps the event list and
 * the status as runes state so components re-render as the trace grows.
 * EventSource reconnects by itself and resumes from the last `id:` through
 * the Last-Event-ID header; the first connection passes `?after=`.
 */
import { briefStatusSchema, sseStatusDataSchema, type BriefStatus } from '$lib/api/contracts';
import { agentEventSchema, type AgentEvent } from '$lib/brief/events';

export class BriefStream {
	events = $state<AgentEvent[]>([]);
	status = $state<BriefStatus>('running');
	connected = $state(false);
	done = $state(false);
	error = $state<string | undefined>(undefined);
	/** Called once when the server reports the brief is terminal. */
	ondone?: (status: BriefStatus) => void;

	#source: EventSource | undefined;
	// Bookkeeping only, never rendered, so it does not need to be reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	#seen = new Set<string>();
	/** Database id of the last event received; the SSE `id:` field. */
	#lastId = 0;

	constructor(
		readonly briefId: string,
		initialEvents: AgentEvent[] = [],
		initialStatus: BriefStatus = 'running',
		/** Database id of the last event already rendered by the server, 0 for none. */
		readonly initialAfter = 0
	) {
		this.events = initialEvents;
		this.status = initialStatus;
		for (const e of initialEvents) this.#seen.add(`${e.runId}:${e.seq}`);
	}

	start(): void {
		if (this.#source || typeof EventSource === 'undefined') return;
		const source = new EventSource(
			`/api/briefs/${this.briefId}/events?after=${this.#lastId || this.initialAfter}`
		);
		this.#source = source;
		source.onopen = () => {
			this.connected = true;
			this.error = undefined;
		};
		source.onerror = () => {
			this.connected = false;
			if (this.done) source.close();
			else this.error = 'Connection lost; reconnecting.';
		};
		source.addEventListener('agent', (message) => {
			const m = message as MessageEvent;
			const id = Number(m.lastEventId);
			if (Number.isFinite(id) && id > this.#lastId) this.#lastId = id;
			const parsed = agentEventSchema.safeParse(JSON.parse(m.data));
			if (!parsed.success) return;
			const key = `${parsed.data.runId}:${parsed.data.seq}`;
			if (this.#seen.has(key)) return;
			this.#seen.add(key);
			this.events = [...this.events, parsed.data];
		});
		source.addEventListener('status', (message) => {
			const parsed = sseStatusDataSchema.safeParse(JSON.parse((message as MessageEvent).data));
			if (parsed.success) this.status = parsed.data.status;
		});
		source.addEventListener('done', (message) => {
			const parsed = briefStatusSchema.safeParse(
				JSON.parse((message as MessageEvent).data)?.status
			);
			if (parsed.success) this.status = parsed.data;
			this.done = true;
			this.connected = false;
			source.close();
			this.ondone?.(this.status);
		});
	}

	stop(): void {
		this.#source?.close();
		this.#source = undefined;
		this.connected = false;
	}
}
