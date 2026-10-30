<script lang="ts">
	import EChart from './EChart.svelte';
	import { priceLevelDistribution } from './price-levels';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const dist = $derived(priceLevelDistribution(brief));
	const labels = ['$', '$$', '$$$', '$$$$'];

	const option = $derived({
		animation: false,
		grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
		tooltip: { trigger: 'axis', axisPointer: { type: 'none' } },
		xAxis: {
			type: 'category',
			data: labels,
			axisTick: { show: false },
			axisLabel: { color: '#52525b' }
		},
		yAxis: {
			type: 'value',
			minInterval: 1,
			splitLine: { lineStyle: { color: '#f4f4f5' } },
			axisLabel: { color: '#71717a' }
		},
		series: [
			{
				type: 'bar',
				data: dist.fromPlaces,
				barMaxWidth: 48,
				itemStyle: { color: '#4f46e5', borderRadius: [4, 4, 0, 0] },
				label: { show: true, position: 'top', color: '#3f3f46' }
			}
		]
	});
	const summary = $derived(
		'Places by price level: ' + labels.map((l, i) => `${dist.fromPlaces[i]} at ${l}`).join(', ')
	);
	const quantiles = $derived(
		dist.fromHeatmap
			? [
					{ k: 'p25', v: dist.fromHeatmap.p25 },
					{ k: 'p50', v: dist.fromHeatmap.p50 },
					{ k: 'p75', v: dist.fromHeatmap.p75 },
					{ k: 'p90', v: dist.fromHeatmap.p90 }
				]
			: []
	);
</script>

<figure class="mt-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200 print:break-inside-avoid">
	{#if dist.total === 0 && !dist.fromHeatmap}
		<p class="text-sm text-zinc-600">
			No price-level data came back from Qloo for this area, so the tiers rest on the audience
			signals alone.
		</p>
	{:else}
		{#if dist.total > 0}
			<EChart {option} fallback={summary} class="h-44 w-full" />
		{:else}
			<p class="text-sm text-zinc-600">No individual places carried a price level.</p>
		{/if}
		{#if quantiles.length}
			<dl class="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-100 pt-3 text-xs">
				<dt class="text-zinc-500">Heatmap price level (0 to 1)</dt>
				{#each quantiles as q (q.k)}
					<dd class="text-zinc-800 tabular-nums">
						<span class="text-zinc-500">{q.k}</span>
						{q.v.toFixed(2)}
					</dd>
				{/each}
			</dl>
		{/if}
	{/if}
	<figcaption class="mt-3 text-xs text-zinc-500">
		Price levels of the places Qloo returned near the heat ({dist.total}
		{dist.total === 1 ? 'place' : 'places'}), the proxy behind the tiers.
	</figcaption>
</figure>
