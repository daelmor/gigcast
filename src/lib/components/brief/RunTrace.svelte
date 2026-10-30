<script lang="ts">
	/**
	 * The agent trace: one mono line per tool call on surface-sunken, tool names in beam-text,
	 * a pulsing beam dot on the call in flight, a Live badge while streaming. This is where the
	 * "cast" in gigcast shows up in the UI.
	 */
	import { tick } from 'svelte';
	import type { AgentEvent } from '$lib/brief/events';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { formatDuration } from './format';
	import { groupTraceRows, traceCounters } from './trace';

	interface Props {
		events: AgentEvent[];
		live?: boolean;
		status?: 'queued' | 'running' | 'complete' | 'partial' | 'failed';
	}

	let { events, live = false, status }: Props = $props();

	const rows = $derived(groupTraceRows(events));
	const counters = $derived(traceCounters(events));
	let showInputs = $state(false);
	let scroller = $state<HTMLOListElement>();

	$effect(() => {
		const count = rows.length;
		if (!live || count === 0) return;
		tick().then(() => scroller?.lastElementChild?.scrollIntoView({ block: 'nearest' }));
	});

	const streaming = $derived(live && (status === 'running' || status === 'queued'));
	const stats = $derived([
		['Tool calls', String(counters.toolCalls)],
		['Qloo requests', String(counters.qlooRequests)],
		['Cache hits', String(counters.cacheHits)],
		['Elapsed', formatDuration(counters.elapsedMs)]
	]);
	const short = (value: unknown) => {
		try {
			const s = JSON.stringify(value);
			return s.length > 160 ? `${s.slice(0, 157)}…` : s;
		} catch {
			return '';
		}
	};
</script>

<div class="overflow-hidden rounded-lg border border-line bg-surface-raised">
	<div
		class="flex flex-wrap items-center justify-between gap-space-2 border-b border-line px-4 py-3"
	>
		<h3 class="flex items-center gap-space-2 type-heading-3 text-ink">
			Agent trace
			{#if streaming}
				<Badge tone="live">Live</Badge>
			{:else if status}
				<span class="type-small font-normal text-ink-subtle">{status}</span>
			{/if}
		</h3>
		<label class="flex cursor-pointer items-center gap-space-2 type-small text-ink-muted">
			<input type="checkbox" bind:checked={showInputs} class="accent-action" />
			Show inputs
		</label>
	</div>
	<dl class="grid grid-cols-2 gap-px border-b border-line bg-line text-center sm:grid-cols-4">
		{#each stats as [k, v] (k)}
			<div class="bg-surface-raised px-2 py-2">
				<dd class="type-heading-3 text-ink tabular-nums">{v}</dd>
				<dt class="type-small text-ink-subtle">{k}</dt>
			</div>
		{/each}
	</dl>

	{#if rows.length === 0}
		<div
			class="flex items-center justify-center gap-space-2 bg-surface-sunken px-4 py-10 type-data text-ink-muted"
		>
			<span class="size-2 animate-pulse-live rounded-full bg-beam" aria-hidden="true"></span>
			Waiting for the agent to start
		</div>
	{:else}
		<ol
			bind:this={scroller}
			class="grid max-h-[32rem] gap-1.5 overflow-y-auto bg-surface-sunken px-4 py-3 type-data"
			tabindex="0"
			aria-label="Tool calls"
		>
			{#each rows as row, i (row.kind === 'tool' ? row.toolCallId : `${row.kind}-${row.seq}-${i}`)}
				<li class="min-w-0 text-ink-muted">
					{#if row.kind === 'tool'}
						<div class="grid grid-cols-[16px_auto_minmax(0,1fr)] items-baseline gap-space-2">
							{#if row.pending}
								<span
									class="size-2 animate-pulse-live self-center rounded-full bg-beam ring-[3px] ring-signal-soft"
									role="img"
									aria-label="Running"
								></span>
							{:else}
								<span
									class="size-2 self-center rounded-full {row.ok ? 'bg-grounded' : 'bg-critical'}"
									role="img"
									aria-label={row.ok ? 'Succeeded' : 'Failed'}
								></span>
							{/if}
							<span class="font-medium {row.ok === false ? 'text-critical' : 'text-beam-text'}"
								>{row.tool}</span
							>
							<span class="flex min-w-0 items-baseline gap-space-2">
								<span class="min-w-0 truncate text-ink-muted">{short(row.input)}</span>
								{#if row.cacheHit}
									<span class="rounded-sm bg-signal-soft px-1 type-data-sm text-signal">cache</span>
								{/if}
								{#if row.durationMs !== undefined}
									<span class="ml-auto type-data-sm text-ink-muted tabular-nums"
										>{formatDuration(row.durationMs)}</span
									>
								{/if}
							</span>
						</div>
						{#if row.summary}
							<p class="pl-6 {row.ok === false ? 'text-critical' : 'text-ink-muted'}">
								{row.summary}
							</p>
						{:else if row.pending}
							<p class="pl-6 text-ink-muted">Running…</p>
						{/if}
						{#if showInputs && row.input !== undefined}
							<pre
								class="mt-1 ml-6 max-h-40 overflow-auto rounded-sm border border-line bg-surface-raised p-2 type-data-sm break-words whitespace-pre-wrap text-ink-muted">{JSON.stringify(
									row.input,
									null,
									2
								)}</pre>
						{/if}
					{:else if row.kind === 'text'}
						<p class="pl-6 text-ink-muted italic">{row.text}</p>
					{:else if row.kind === 'error'}
						<p class="rounded-sm bg-critical-soft px-2.5 py-1.5 text-critical">
							<span class="font-medium">{row.fatal ? 'Fatal error' : 'Error'}:</span>
							{row.message}
						</p>
					{:else if row.kind === 'run'}
						<p class="text-ink-muted">Run started on {row.model} ({row.runKind})</p>
					{:else}
						<p class="font-medium text-grounded">
							Brief {row.status === 'complete' ? 'complete' : 'finished with gaps'}
						</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</div>
