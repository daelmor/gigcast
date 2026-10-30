<script lang="ts">
	import { tick } from 'svelte';
	import type { AgentEvent } from '$lib/brief/events';
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

	const stats = $derived([
		['Tool calls', counters.toolCalls],
		['Qloo requests', counters.qlooRequests],
		['Cache hits', counters.cacheHits],
		['Elapsed', formatDuration(counters.elapsedMs)]
	]);
</script>

<div class="bg-white ring-zinc-200 rounded-xl ring-1">
	<div class="border-zinc-200 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
		<h3 class="text-zinc-900 text-sm font-semibold">
			Agent trace
			{#if status}<span class="text-zinc-500 ml-1 text-xs font-normal">({status})</span>{/if}
		</h3>
		<label class="text-zinc-600 flex cursor-pointer items-center gap-2 text-xs">
			<input type="checkbox" bind:checked={showInputs} class="accent-indigo-600" />
			Show inputs
		</label>
	</div>
	<dl class="bg-zinc-200 grid grid-cols-2 gap-px text-center sm:grid-cols-4">
		{#each stats as [k, v] (k)}
			<div class="bg-white px-2 py-2">
				<dd class="text-zinc-900 text-base font-semibold tabular-nums">{v}</dd>
				<dt class="text-zinc-500 text-xs">{k}</dt>
			</div>
		{/each}
	</dl>

	{#if rows.length === 0}
		<div class="text-zinc-500 flex items-center justify-center gap-2 px-4 py-10 text-sm">
			<span class="bg-zinc-400 size-2 animate-pulse rounded-full" aria-hidden="true"></span>
			Waiting for the agent to start
		</div>
	{:else}
		<ol bind:this={scroller} class="divide-zinc-100 max-h-[32rem] divide-y overflow-y-auto">
			{#each rows as row, i (row.kind === 'tool' ? row.toolCallId : `${row.kind}-${row.seq}-${i}`)}
				<li class="px-4 py-2.5 text-sm">
					{#if row.kind === 'tool'}
						<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
							{#if row.pending}
								<span class="bg-indigo-500 size-2 animate-pulse rounded-full" aria-label="Running"
								></span>
							{:else}
								<span
									class="size-2 rounded-full {row.ok ? 'bg-emerald-500' : 'bg-rose-500'}"
									aria-label={row.ok ? 'Succeeded' : 'Failed'}
								></span>
							{/if}
							<code
								class="font-mono text-xs font-medium {row.ok === false
									? 'text-rose-700'
									: 'text-zinc-900'}">{row.tool}</code
							>
							{#if row.cacheHit}
								<span
									class="bg-sky-50 text-sky-700 ring-sky-600/20 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset"
									>cache</span
								>
							{/if}
							{#if row.durationMs !== undefined}
								<span class="text-zinc-500 ml-auto text-xs tabular-nums"
									>{formatDuration(row.durationMs)}</span
								>
							{/if}
						</div>
						{#if row.summary}
							<p class="mt-0.5 pl-4 text-xs {row.ok === false ? 'text-rose-700' : 'text-zinc-600'}">
								{row.summary}
							</p>
						{:else if row.pending}
							<p class="text-zinc-400 mt-0.5 pl-4 text-xs">Running…</p>
						{/if}
						{#if showInputs && row.input !== undefined}
							<pre
								class="bg-zinc-50 text-zinc-700 ring-zinc-200 mt-1.5 ml-4 max-h-40 overflow-auto rounded-lg p-2 font-mono text-[11px] break-words whitespace-pre-wrap ring-1">{JSON.stringify(
									row.input,
									null,
									2
								)}</pre>
						{/if}
					{:else if row.kind === 'text'}
						<p class="text-zinc-600 italic">{row.text}</p>
					{:else if row.kind === 'error'}
						<p class="bg-rose-50 text-rose-800 ring-rose-200 rounded-lg px-2.5 py-1.5 ring-1">
							<span class="font-medium">{row.fatal ? 'Fatal error' : 'Error'}:</span>
							{row.message}
						</p>
					{:else if row.kind === 'run'}
						<p class="text-zinc-500 text-xs">Run started on {row.model} ({row.runKind})</p>
					{:else}
						<p class="text-emerald-700 text-xs font-medium">
							Brief {row.status === 'complete' ? 'complete' : 'finished with gaps'}
						</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</div>
