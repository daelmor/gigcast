<script lang="ts">
	import Card from '../ui/Card.svelte';
	import PriceLevelChart from './PriceLevelChart.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import { pct } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const pricing = $derived(brief.draft.pricing);
	const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
</script>

<section aria-labelledby="pricing">
	<SectionHeader
		id="pricing"
		kicker="Section 7 · Pricing"
		title="Pricing guidance"
		note={pricing.note}
	/>
	<p class="mb-space-3 type-small text-ink-subtle">
		A heuristic built on audience signals, not a price from the data. Treat it as a starting point
		for your own numbers.
	</p>
	{#if pricing.tiers.length === 0}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			No price tiers were suggested.
		</p>
	{:else}
		<Card padded={false} class="overflow-x-auto">
			<table class="w-full min-w-[34rem] text-left type-small">
				<thead class="border-b border-line bg-surface-sunken type-label text-ink-muted">
					<tr>
						<th class="px-space-4 py-space-2 font-semibold">Tier</th>
						<th class="px-space-4 py-space-2 font-semibold">Price</th>
						<th class="px-space-4 py-space-2 font-semibold">Share of capacity</th>
						<th class="px-space-4 py-space-2 font-semibold">Rationale</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each pricing.tiers as tier, i (i)}
						<tr class="align-top">
							<td class="px-space-4 py-space-3 font-semibold text-ink">{tier.name}</td>
							<td class="px-space-4 py-space-3 whitespace-nowrap text-ink tabular-nums"
								><span class="type-numeral">{fmt(tier.price)}</span>
								<span class="text-ink-muted">{pricing.currency}</span></td
							>
							<td class="px-space-4 py-space-3 text-ink tabular-nums">{pct(tier.share)}</td>
							<td class="px-space-4 py-space-3 text-ink-muted">{tier.rationale}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Card>
	{/if}
	<PriceLevelChart {brief} />
	{#if pricing.assumptions.length > 0}
		<div class="mt-space-4">
			<h3 class="type-heading-3 text-ink">Assumptions</h3>
			<ul class="mt-space-1 list-disc space-y-0.5 pl-5 type-small text-ink-muted">
				{#each pricing.assumptions as a, i (i)}<li>{a}</li>{/each}
			</ul>
		</div>
	{/if}
</section>
