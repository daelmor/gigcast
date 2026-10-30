<script lang="ts">
	import PriceLevelChart from './PriceLevelChart.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import { pct } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const pricing = $derived(brief.draft.pricing);
	const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
</script>

<section aria-labelledby="pricing">
	<SectionHeader id="pricing" title="Pricing guidance" note={pricing.note} />
	<p class="mb-3 text-xs text-zinc-500">
		A heuristic built on audience signals, not a Qloo price. Treat it as a starting point for your
		own numbers.
	</p>
	{#if pricing.tiers.length === 0}
		<p class="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
			No price tiers were suggested.
		</p>
	{:else}
		<div class="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
			<table class="w-full min-w-[34rem] text-left text-sm">
				<thead class="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 uppercase">
					<tr>
						<th class="px-4 py-2 font-medium">Tier</th>
						<th class="px-4 py-2 font-medium">Price</th>
						<th class="px-4 py-2 font-medium">Share of capacity</th>
						<th class="px-4 py-2 font-medium">Rationale</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-100">
					{#each pricing.tiers as tier, i (i)}
						<tr class="align-top">
							<td class="px-4 py-3 font-medium text-zinc-900">{tier.name}</td>
							<td class="px-4 py-3 whitespace-nowrap text-zinc-800 tabular-nums"
								>{fmt(tier.price)} {pricing.currency}</td
							>
							<td class="px-4 py-3 text-zinc-800 tabular-nums">{pct(tier.share)}</td>
							<td class="px-4 py-3 text-zinc-600">{tier.rationale}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<PriceLevelChart {brief} />
	{#if pricing.assumptions.length > 0}
		<div class="mt-4">
			<h3 class="text-sm font-semibold text-zinc-900">Assumptions</h3>
			<ul class="mt-1 list-disc space-y-0.5 pl-5 text-sm text-zinc-600">
				{#each pricing.assumptions as a, i (i)}<li>{a}</li>{/each}
			</ul>
		</div>
	{/if}
</section>
