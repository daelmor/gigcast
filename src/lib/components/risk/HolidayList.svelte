<script lang="ts">
	import { formatDate } from '../brief/format';
	import type { Holiday, LongWeekend } from '$lib/brief/schema';

	interface Props {
		holidays: Holiday[];
		longWeekends?: LongWeekend[];
	}

	let { holidays, longWeekends = [] }: Props = $props();
</script>

<div class="space-y-space-4">
	<div>
		<h4 class="type-label text-ink-subtle">Public holidays</h4>
		{#if holidays.length === 0}
			<p class="mt-space-1 type-small text-ink-muted">No public holidays in this period.</p>
		{:else}
			<ul class="mt-space-2 divide-y divide-line">
				{#each holidays as h, i (i)}
					<li
						class="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 type-small {h.inWindow
							? '-mx-2 rounded-sm bg-signal-soft px-2 text-ink'
							: ''}"
					>
						<span class="min-w-0">
							<span class="font-medium text-ink">{h.name}</span>
							{#if h.localName !== h.name}<span class="text-ink-muted"> · {h.localName}</span>{/if}
							{#if h.inWindow}<span class="ml-1 font-semibold text-ink">In your window</span>{/if}
						</span>
						<span class="text-ink-muted tabular-nums">{h.weekday}, {formatDate(h.date)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	{#if longWeekends.length > 0}
		<div>
			<h4 class="type-label text-ink-subtle">Long weekends</h4>
			<ul class="mt-space-2 space-y-1.5">
				{#each longWeekends as w, i (i)}
					<li
						class="rounded-sm px-2 py-1.5 type-small {w.inWindow
							? 'bg-signal-soft text-ink'
							: 'bg-surface-sunken text-ink-muted'}"
					>
						<span class="font-medium text-ink">{w.days} days</span>
						<span>, {formatDate(w.start)} to {formatDate(w.end)}</span>
						{#if w.holidays.length > 0}
							<span> ({w.holidays.join(', ')})</span>
						{/if}
						{#if w.inWindow}<span class="ml-1 font-semibold text-ink">In your window</span>{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
