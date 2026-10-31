<script lang="ts">
	import Card from '../ui/Card.svelte';
	import { BRIEF_SECTIONS } from '$lib/brief/schema';
	import type { AgentEvent } from '$lib/brief/events';
	import { formatDuration } from './format';
	import { SECTION_LABELS, sectionStates } from './progress';
	import { traceCounters } from './trace';

	interface Props {
		events: AgentEvent[];
		status: 'queued' | 'running' | 'complete' | 'partial' | 'failed';
		/** Place in the queue while waiting; 1 is next. */
		position?: number;
	}

	let { events, status, position }: Props = $props();

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

<Card>
	<div aria-live="polite">
		<div class="mb-space-3 flex items-center justify-between gap-space-3">
			<h3 class="type-heading-3 text-ink">
				{#if status === 'queued'}Queued{#if position === 1}
						· next in line{:else if position}
						· {position - 1} ahead{/if}{:else if status === 'running'}Building the brief{:else if status === 'failed'}Run
					failed{:else if status === 'partial'}Brief finished with gaps{:else}Brief ready{/if}
			</h3>
			<span class="type-small text-ink-subtle tabular-nums">{formatDuration(elapsed)}</span>
		</div>
		<ol class="flex flex-wrap gap-space-2">
			{#each BRIEF_SECTIONS as s (s)}
				{@const st = states[s]}
				<li
					class="inline-flex h-7 items-center gap-1.5 rounded-pill border border-line bg-surface-sunken px-3 text-[13px] leading-5 font-medium {st ===
					'pending'
						? 'text-ink-subtle'
						: 'text-ink'}"
				>
					{#if st === 'ready'}
						<svg
							class="size-3.5 shrink-0 text-grounded"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
							><path
								fill-rule="evenodd"
								d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
								clip-rule="evenodd"
							/></svg
						>
					{:else if st === 'in_progress'}
						<span class="size-2 shrink-0 animate-pulse-live rounded-full bg-beam" aria-hidden="true"
						></span>
					{:else}
						<span class="size-2 shrink-0 rounded-full border border-ink-subtle" aria-hidden="true"
						></span>
					{/if}
					<span class="whitespace-nowrap">{SECTION_LABELS[s]}</span>
					<span class="sr-only">{st.replace('_', ' ')}</span>
				</li>
			{/each}
		</ol>
	</div>
</Card>
