<script lang="ts">
	import { BRIEF_SECTIONS } from '$lib/brief/schema';
	import type { AgentEvent } from '$lib/brief/events';
	import { formatDuration } from './format';
	import { SECTION_LABELS, sectionStates } from './progress';
	import { traceCounters } from './trace';

	interface Props {
		events: AgentEvent[];
		status: 'queued' | 'running' | 'complete' | 'partial' | 'failed';
	}

	let { events, status }: Props = $props();

	const states = $derived(sectionStates(events));
	const running = $derived(status === 'running' || status === 'queued');

	let now = $state(Date.now());
	const mountedAt = Date.now();
	$effect(() => {
		if (!running) return;
		now = Date.now();
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const elapsed = $derived.by(() => {
		if (!running) return traceCounters(events).elapsedMs;
		const first = events.length > 0 ? Date.parse(events[0].at) : NaN;
		return Math.max(0, now - (Number.isFinite(first) ? first : mountedAt));
	});
</script>

<div class="rounded-xl bg-white p-4 ring-1 ring-zinc-200" aria-live="polite">
	<div class="mb-3 flex items-center justify-between gap-3">
		<h3 class="text-sm font-semibold text-zinc-900">
			{#if status === 'queued'}Queued{:else if status === 'running'}Building the brief{:else if status === 'failed'}Run
				failed{:else if status === 'partial'}Brief finished with gaps{:else}Brief ready{/if}
		</h3>
		<span class="text-xs text-zinc-500 tabular-nums">{formatDuration(elapsed)}</span>
	</div>
	<ol class="flex flex-wrap gap-2">
		{#each BRIEF_SECTIONS as s (s)}
			{@const st = states[s]}
			<li
				class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ring-1 ring-inset {st ===
				'ready'
					? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
					: st === 'in_progress'
						? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
						: 'bg-zinc-50 text-zinc-500 ring-zinc-200'}"
			>
				{#if st === 'ready'}
					<svg class="size-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><path
							fill-rule="evenodd"
							d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
							clip-rule="evenodd"
						/></svg
					>
				{:else if st === 'in_progress'}
					<span class="size-2 shrink-0 animate-pulse rounded-full bg-indigo-500" aria-hidden="true"
					></span>
				{:else}
					<span class="size-2 shrink-0 rounded-full bg-zinc-300" aria-hidden="true"></span>
				{/if}
				<span class="whitespace-nowrap">{SECTION_LABELS[s]}</span>
				<span class="sr-only">{st.replace('_', ' ')}</span>
			</li>
		{/each}
	</ol>
</div>
