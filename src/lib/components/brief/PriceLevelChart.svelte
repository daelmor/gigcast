<script lang="ts">
	import { onMount } from 'svelte';
	import EChart from './EChart.svelte';
	import { theme, watchTheme } from '$lib/client/theme-colors.svelte';
	import { priceLevelDistribution } from './price-levels';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const dist = $derived(priceLevelDistribution(brief));
	const labels = ['$', '$$', '$$$', '$$$$'];
	onMount(() => watchTheme());
	const c = $derived(theme.colors);

	const option = $derived({
		animation: false,
		grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
		tooltip: { trigger: 'axis', axisPointer: { type: 'none' } },
		xAxis: {
			type: 'category',
			data: labels,
			axisTick: { show: false },
			axisLabel: { color: c['ink-muted'], fontFamily: theme.fonts.mono }
		},
		yAxis: {
			type: 'value',
			minInterval: 1,
			splitLine: { lineStyle: { color: c.line } },
			axisLabel: { color: c['ink-subtle'], fontFamily: theme.fonts.mono }
		},
		series: [
			{
				type: 'bar',
				data: dist.fromPlaces,
				barMaxWidth: 48,
				itemStyle: { color: c['chart-1'], borderRadius: [4, 4, 0, 0] },
				label: { show: true, position: 'top', color: c['ink-muted'], fontFamily: theme.fonts.mono }
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

<figure class="mt-4 rounded-lg border border-line bg-surface-raised p-4 print:break-inside-avoid">
	{#if dist.total === 0 && !dist.fromHeatmap}
		<p class="type-small text-ink-muted">
			No price-level data came back for this area, so the tiers rest on the audience signals alone.
		</p>
	{:else}
		{#if dist.total > 0}
			<EChart {option} fallback={summary} class="h-44 w-full" />
		{:else}
			<p class="type-small text-ink-muted">No individual places carried a price level.</p>
		{/if}
		{#if quantiles.length}
			<dl class="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 type-small">
				<dt class="text-ink-subtle">Heatmap price level (0 to 1)</dt>
				{#each quantiles as q (q.k)}
					<dd class="text-ink tabular-nums">
						<span class="text-ink-subtle">{q.k}</span>
						{q.v.toFixed(2)}
					</dd>
				{/each}
			</dl>
		{/if}
	{/if}
	<figcaption class="mt-3 type-small text-ink-subtle">
		Price levels of the places returned near the heat ({dist.total}
		{dist.total === 1 ? 'place' : 'places'}), the proxy behind the tiers.
	</figcaption>
</figure>
