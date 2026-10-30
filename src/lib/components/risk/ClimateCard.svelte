<script lang="ts">
	import { num, pct } from '../brief/format';
	import type { ClimateWindow } from '$lib/brief/schema';

	let { climate }: { climate: ClimateWindow } = $props();

	const deg = (v: number | null) => (num(v, 1) ? `${num(v, 1)} °C` : 'n/a');
	const mm = (v: number | null) => (num(v, 1) ? `${num(v, 1)} mm` : 'n/a');

	const stats = $derived([
		{ label: 'Avg high', value: deg(climate.tmaxMean) },
		{ label: 'Avg low', value: deg(climate.tminMean) },
		{ label: 'Mean precipitation', value: mm(climate.precipMean) },
		{
			label: 'Rainy days',
			value: climate.rainDayShare === null ? 'n/a' : pct(climate.rainDayShare)
		},
		{ label: 'Wettest single day', value: mm(climate.precipMaxDay) }
	]);
</script>

<div>
	<dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
		{#each stats as s (s.label)}
			<div class="bg-zinc-50 ring-zinc-200 rounded-lg p-3 ring-1">
				<dt class="text-zinc-500 text-xs">{s.label}</dt>
				<dd class="text-zinc-900 mt-0.5 font-semibold tabular-nums">{s.value}</dd>
			</div>
		{/each}
	</dl>
	<p class="text-zinc-500 mt-2 text-xs">
		{#if climate.years.length > 0}Based on the same dates in {climate.years.join(', ')}.{:else}No
			years of observations were available.{/if}
		{#if climate.note}{climate.note}{/if}
	</p>
</div>
