<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BriefListItem } from '$lib/api/contracts';
	import { findMarket } from '$lib/markets';

	let { briefs }: { briefs: BriefListItem[] } = $props();

	const verdictStyle: Record<NonNullable<BriefListItem['verdict']>, string> = {
		promising: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
		mixed: 'bg-amber-50 text-amber-900 ring-amber-600/25',
		weak: 'bg-rose-50 text-rose-800 ring-rose-600/25',
		insufficient_data: 'bg-zinc-100 text-zinc-600 ring-zinc-500/25'
	};
	const verdictText: Record<NonNullable<BriefListItem['verdict']>, string> = {
		promising: 'Promising',
		mixed: 'Mixed',
		weak: 'Weak',
		insufficient_data: 'Insufficient data'
	};

	const dateWindow = (b: BriefListItem) =>
		b.dateFrom && b.dateTo && b.dateTo !== b.dateFrom
			? `${b.dateFrom} to ${b.dateTo}`
			: (b.dateFrom ?? '');
</script>

{#if briefs.length > 0}
	<section class="mt-12" aria-labelledby="examples-title">
		<h2 id="examples-title" class="text-lg font-semibold">See a finished brief</h2>
		<ul class="mt-4 grid gap-4 md:grid-cols-3">
			{#each briefs as b (b.id)}
				<li class="flex flex-col rounded-xl bg-white p-5 ring-1 ring-zinc-200">
					<div class="flex items-start justify-between gap-2">
						<span class="font-semibold text-zinc-900">{b.artistName}</span>
						{#if b.verdict}
							<span
								class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {verdictStyle[
									b.verdict
								]}">{verdictText[b.verdict]}</span
							>
						{/if}
					</div>
					<span class="text-sm text-zinc-500">{findMarket(b.marketId ?? '')?.name ?? b.city}</span>
					{#if b.headline}<p class="mt-2 text-sm text-zinc-700">{b.headline}</p>{/if}
					{#if dateWindow(b)}<p class="mt-2 text-xs text-zinc-500">{dateWindow(b)}</p>{/if}
					<a
						href={resolve('/brief/[id]', { id: b.id })}
						class="mt-auto pt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
						>Open the brief</a
					>
				</li>
			{/each}
		</ul>
	</section>
{/if}
