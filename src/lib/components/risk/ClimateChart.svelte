<script lang="ts">
	import { onMount } from 'svelte';
	import EChart from '../brief/EChart.svelte';
	import { theme, watchTheme, withAlpha } from '$lib/client/theme-colors.svelte';
	import type { ClimateMonth } from '$lib/brief/schema';

	let { months }: { months: ClimateMonth[] } = $props();

	const NAMES = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const sorted = $derived([...months].sort((a, b) => a.month - b.month));
	onMount(() => watchTheme());
	const c = $derived(theme.colors);
	const axisText = $derived({ color: c['ink-muted'], fontSize: 12, fontFamily: theme.fonts.mono });

	const option = $derived({
		grid: { left: 40, right: 44, top: 28, bottom: 28 },
		tooltip: { trigger: 'axis' },
		xAxis: {
			type: 'category',
			data: sorted.map((m) => NAMES[m.month - 1]),
			axisLine: { lineStyle: { color: c['line-strong'] } },
			axisTick: { show: false },
			axisLabel: axisText
		},
		yAxis: [
			{
				type: 'value',
				name: '°C',
				nameTextStyle: axisText,
				axisLabel: axisText,
				splitLine: { lineStyle: { color: c.line } }
			},
			{
				type: 'value',
				name: 'mm',
				nameTextStyle: axisText,
				axisLabel: axisText,
				splitLine: { show: false }
			}
		],
		series: [
			{
				name: 'Precipitation (mm)',
				type: 'bar',
				yAxisIndex: 1,
				barMaxWidth: 18,
				data: sorted.map((m) => m.precipMean),
				itemStyle: { color: withAlpha(c['chart-2'], 0.45), borderRadius: [3, 3, 0, 0] }
			},
			{
				name: 'Avg high (°C)',
				type: 'line',
				data: sorted.map((m) => m.tmaxMean),
				smooth: true,
				symbolSize: 5,
				lineStyle: { color: c['chart-3'], width: 2 },
				itemStyle: { color: c['chart-3'] }
			},
			{
				name: 'Avg low (°C)',
				type: 'line',
				data: sorted.map((m) => m.tminMean),
				smooth: true,
				symbolSize: 5,
				lineStyle: { color: c['chart-1'], width: 2 },
				itemStyle: { color: c['chart-1'] }
			}
		]
	});
</script>

<div>
	<EChart
		{option}
		class="h-64 w-full"
		fallback="Monthly climate normals: average high and low temperature and precipitation"
	/>
	<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 type-small text-ink-muted">
		<li class="flex items-center gap-1.5">
			<span class="h-0.5 w-4 bg-chart-3"></span>Avg high (°C)
		</li>
		<li class="flex items-center gap-1.5">
			<span class="h-0.5 w-4 bg-chart-1"></span>Avg low (°C)
		</li>
		<li class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-sm bg-chart-2 opacity-50"></span>Precipitation (mm)
		</li>
	</ul>
</div>
