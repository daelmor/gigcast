<script lang="ts">
	import Badge from '../ui/Badge.svelte';
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import { riskLevel } from '../ui/tones';
	import { categoryLabel } from './labels';
	import type { RiskScore } from '$lib/brief/schema';

	let { score }: { score: RiskScore } = $props();

	const level = $derived(riskLevel(score.value));
	const cats = $derived(
		Object.entries(score.byCategory)
			.filter(([, v]) => v > 0)
			.sort((a, b) => b[1] - a[1])
	);
</script>

<Card>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<p class="type-label text-ink-subtle">Market risk score</p>
		<p class="type-small text-ink-muted">
			<span class="font-semibold text-ink tabular-nums">{score.itemCount}</span> items,
			<span class="font-semibold text-ink tabular-nums">{score.recentCount}</span> from the last 7 days
		</p>
	</div>
	<div class="mt-space-2 flex flex-wrap items-center gap-x-3 gap-y-1">
		<span class="type-numeral text-ink tabular-nums">{score.value}</span>
		<span class="type-small text-ink-subtle">/ 100</span>
		<Badge tone={level.tone}>{level.word}</Badge>
	</div>
	<div
		class="mt-space-3 h-2 overflow-hidden rounded-pill bg-surface-sunken"
		role="meter"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={score.value}
		aria-label="Market risk score, {level.word}"
	>
		<div class="h-full rounded-pill bg-signal" style:width="{score.value}%"></div>
	</div>
	{#if cats.length > 0}
		<ul class="mt-space-4 flex flex-wrap gap-space-2" aria-label="Score by category">
			{#each cats as [category, value] (category)}
				<li>
					<Chip>
						{categoryLabel(category)}
						<span class="ml-1.5 tabular-nums">{value}</span>
					</Chip>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="mt-space-3 type-small text-ink-subtle">
		Recent, severe items weigh more; older items decay. It is a news-volume signal, not a safety
		judgment.
	</p>
</Card>
