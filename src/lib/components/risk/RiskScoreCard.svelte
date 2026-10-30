<script lang="ts">
	import { categoryLabel, categoryStyle, riskLevelWord } from './labels';
	import type { RiskScore } from '$lib/brief/schema';

	let { score }: { score: RiskScore } = $props();

	const word = $derived(riskLevelWord(score.value));
	const bar = $derived(
		word === 'quiet' ? 'bg-emerald-500' : word === 'watch' ? 'bg-amber-500' : 'bg-rose-500'
	);
	const cats = $derived(
		Object.entries(score.byCategory)
			.filter(([, v]) => v > 0)
			.sort((a, b) => b[1] - a[1])
	);
</script>

<div class="bg-white ring-zinc-200 rounded-xl p-5 ring-1">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<p class="text-zinc-500 text-xs font-semibold tracking-wide uppercase">Market risk score</p>
		<p class="text-zinc-600 text-sm">
			<span class="text-zinc-900 font-medium">{score.itemCount}</span> items,
			<span class="text-zinc-900 font-medium">{score.recentCount}</span> from the last 7 days
		</p>
	</div>
	<div class="mt-2 flex items-baseline gap-3">
		<span class="text-zinc-900 text-4xl font-semibold tabular-nums">{score.value}</span>
		<span class="text-zinc-500 text-sm">/ 100</span>
		<span class="text-zinc-800 text-lg font-medium capitalize">{word}</span>
	</div>
	<div
		class="bg-zinc-100 mt-3 h-2 overflow-hidden rounded-full"
		role="meter"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={score.value}
		aria-label="Market risk score, {word}"
	>
		<div class="h-full rounded-full {bar}" style:width="{score.value}%"></div>
	</div>
	{#if cats.length > 0}
		<ul class="mt-4 flex flex-wrap gap-1.5" aria-label="Score by category">
			{#each cats as [category, value] (category)}
				<li
					class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {categoryStyle(
						category
					)}"
				>
					{categoryLabel(category)}
					<span class="tabular-nums opacity-75">{value}</span>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="text-zinc-500 mt-3 text-xs">
		Recent, severe items weigh more; older items decay. It is a news-volume signal, not a safety
		judgment.
	</p>
</div>
