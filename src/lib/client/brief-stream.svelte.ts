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
	#seen = new Set<number>();

	constructor(
		readonly briefId: string,
		initialEvents: AgentEvent[] = [],
		initialStatus: BriefStatus = 'running'
	) {
		this.events = initialEvents;
		this.status = initialStatus;
		for (const e of initialEvents) this.#seen.add(e.seq);
	}

	get lastSeq(): number {
		return this.events.length ? this.events[this.events.length - 1].seq : -1;
	}

	start(): void {
		if (this.#source || typeof EventSource === 'undefined') return;
		const source = new EventSource(`/api/briefs/${this.briefId}/events?after=${this.lastSeq}`);
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
			const parsed = agentEventSchema.safeParse(JSON.parse((message as MessageEvent).data));
			if (!parsed.success || this.#seen.has(parsed.data.seq)) return;
			this.#seen.add(parsed.data.seq);
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
