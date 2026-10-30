<script lang="ts">
	import { formatDate } from '../brief/format';
	import type { Holiday, LongWeekend } from '$lib/brief/schema';

	interface Props {
		holidays: Holiday[];
		longWeekends?: LongWeekend[];
	}

	let { holidays, longWeekends = [] }: Props = $props();
</script>

<div class="space-y-4">
	<div>
		<h4 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Public holidays</h4>
		{#if holidays.length === 0}
			<p class="mt-1 text-sm text-zinc-500">No public holidays in this period.</p>
		{:else}
			<ul class="mt-2 divide-y divide-zinc-100">
				{#each holidays as h, i (i)}
					<li
						class="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-sm {h.inWindow
							? '-mx-2 rounded-lg bg-indigo-50 px-2 ring-1 ring-indigo-600/20'
							: ''}"
					>
						<span class="min-w-0">
							<span class="font-medium text-zinc-900">{h.name}</span>
							{#if h.localName !== h.name}<span class="text-zinc-500"> · {h.localName}</span>{/if}
							{#if h.inWindow}<span class="ml-1 text-xs font-semibold text-indigo-700"
									>In your window</span
								>{/if}
						</span>
						<span class="text-zinc-600 tabular-nums">{h.weekday}, {formatDate(h.date)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	{#if longWeekends.length > 0}
		<div>
			<h4 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Long weekends</h4>
			<ul class="mt-2 space-y-1.5">
				{#each longWeekends as w, i (i)}
					<li
						class="rounded-lg px-2 py-1.5 text-sm ring-1 {w.inWindow
							? 'bg-indigo-50 ring-indigo-600/20'
							: 'bg-zinc-50 ring-zinc-200'}"
					>
						<span class="font-medium text-zinc-900">{w.days} days</span>
						<span class="text-zinc-600">, {formatDate(w.start)} to {formatDate(w.end)}</span>
						{#if w.holidays.length > 0}
							<span class="text-zinc-500"> ({w.holidays.join(', ')})</span>
						{/if}
						{#if w.inWindow}<span class="ml-1 text-xs font-semibold text-indigo-700"
								>In your window</span
							>{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
