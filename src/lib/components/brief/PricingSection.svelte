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
	<p class="text-zinc-500 mb-3 text-xs">
		A heuristic built on audience signals, not a Qloo price. Treat it as a starting point for your
		own numbers.
	</p>
	{#if pricing.tiers.length === 0}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
			No price tiers were suggested.
		</p>
	{:else}
		<div class="bg-white ring-zinc-200 overflow-x-auto rounded-xl ring-1">
			<table class="w-full min-w-[34rem] text-left text-sm">
				<thead class="border-zinc-200 bg-zinc-50 text-zinc-500 border-b text-xs uppercase">
					<tr>
						<th class="px-4 py-2 font-medium">Tier</th>
						<th class="px-4 py-2 font-medium">Price</th>
						<th class="px-4 py-2 font-medium">Share of capacity</th>
						<th class="px-4 py-2 font-medium">Rationale</th>
					</tr>
				</thead>
				<tbody class="divide-zinc-100 divide-y">
					{#each pricing.tiers as tier, i (i)}
						<tr class="align-top">
							<td class="text-zinc-900 px-4 py-3 font-medium">{tier.name}</td>
							<td class="text-zinc-800 px-4 py-3 whitespace-nowrap tabular-nums"
								>{fmt(tier.price)} {pricing.currency}</td
							>
							<td class="text-zinc-800 px-4 py-3 tabular-nums">{pct(tier.share)}</td>
							<td class="text-zinc-600 px-4 py-3">{tier.rationale}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<PriceLevelChart {brief} />
	{#if pricing.assumptions.length > 0}
		<div class="mt-4">
			<h3 class="text-zinc-900 text-sm font-semibold">Assumptions</h3>
			<ul class="text-zinc-600 mt-1 list-disc space-y-0.5 pl-5 text-sm">
				{#each pricing.assumptions as a, i (i)}<li>{a}</li>{/each}
			</ul>
		</div>
	{/if}
</section>
