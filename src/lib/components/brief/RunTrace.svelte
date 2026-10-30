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

<div class="rounded-xl bg-white ring-1 ring-zinc-200">
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
		<h3 class="text-sm font-semibold text-zinc-900">
			Agent trace
			{#if status}<span class="ml-1 text-xs font-normal text-zinc-500">({status})</span>{/if}
		</h3>
		<label class="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
			<input type="checkbox" bind:checked={showInputs} class="accent-indigo-600" />
			Show inputs
		</label>
	</div>
	<dl class="grid grid-cols-2 gap-px bg-zinc-200 text-center sm:grid-cols-4">
		{#each stats as [k, v] (k)}
			<div class="bg-white px-2 py-2">
				<dd class="text-base font-semibold text-zinc-900 tabular-nums">{v}</dd>
				<dt class="text-xs text-zinc-500">{k}</dt>
			</div>
		{/each}
	</dl>

	{#if rows.length === 0}
		<div class="flex items-center justify-center gap-2 px-4 py-10 text-sm text-zinc-500">
			<span class="size-2 animate-pulse rounded-full bg-zinc-400" aria-hidden="true"></span>
			Waiting for the agent to start
		</div>
	{:else}
		<ol bind:this={scroller} class="max-h-[32rem] divide-y divide-zinc-100 overflow-y-auto">
			{#each rows as row, i (row.kind === 'tool' ? row.toolCallId : `${row.kind}-${row.seq}-${i}`)}
				<li class="px-4 py-2.5 text-sm">
					{#if row.kind === 'tool'}
						<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
							{#if row.pending}
								<span class="size-2 animate-pulse rounded-full bg-indigo-500" aria-label="Running"
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
									class="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-600/20 ring-inset"
									>cache</span
								>
							{/if}
							{#if row.durationMs !== undefined}
								<span class="ml-auto text-xs text-zinc-500 tabular-nums"
									>{formatDuration(row.durationMs)}</span
								>
							{/if}
						</div>
						{#if row.summary}
							<p class="mt-0.5 pl-4 text-xs {row.ok === false ? 'text-rose-700' : 'text-zinc-600'}">
								{row.summary}
							</p>
						{:else if row.pending}
							<p class="mt-0.5 pl-4 text-xs text-zinc-400">Running…</p>
						{/if}
						{#if showInputs && row.input !== undefined}
							<pre
								class="mt-1.5 ml-4 max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2 font-mono text-[11px] break-words whitespace-pre-wrap text-zinc-700 ring-1 ring-zinc-200">{JSON.stringify(
									row.input,
									null,
									2
								)}</pre>
						{/if}
					{:else if row.kind === 'text'}
						<p class="text-zinc-600 italic">{row.text}</p>
					{:else if row.kind === 'error'}
						<p class="rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-800 ring-1 ring-rose-200">
							<span class="font-medium">{row.fatal ? 'Fatal error' : 'Error'}:</span>
							{row.message}
						</p>
					{:else if row.kind === 'run'}
						<p class="text-xs text-zinc-500">Run started on {row.model} ({row.runKind})</p>
					{:else}
						<p class="text-xs font-medium text-emerald-700">
							Brief {row.status === 'complete' ? 'complete' : 'finished with gaps'}
						</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</div>
