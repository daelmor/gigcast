<script lang="ts">
	import EChart from '../brief/EChart.svelte';
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
	const axisText = { color: '#52525b', fontSize: 12 };

	const option = $derived({
		grid: { left: 40, right: 44, top: 28, bottom: 28 },
		tooltip: { trigger: 'axis' },
		xAxis: {
			type: 'category',
			data: sorted.map((m) => NAMES[m.month - 1]),
			axisLine: { lineStyle: { color: '#d4d4d8' } },
			axisTick: { show: false },
			axisLabel: axisText
		},
		yAxis: [
			{
				type: 'value',
				name: '°C',
				nameTextStyle: axisText,
				axisLabel: axisText,
				splitLine: { lineStyle: { color: '#f4f4f5' } }
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
				itemStyle: { color: '#bae6fd', borderRadius: [3, 3, 0, 0] }
			},
			{
				name: 'Avg high (°C)',
				type: 'line',
				data: sorted.map((m) => m.tmaxMean),
				smooth: true,
				symbolSize: 5,
				lineStyle: { color: '#e11d48', width: 2 },
				itemStyle: { color: '#e11d48' }
			},
			{
				name: 'Avg low (°C)',
				type: 'line',
				data: sorted.map((m) => m.tminMean),
				smooth: true,
				symbolSize: 5,
				lineStyle: { color: '#4f46e5', width: 2 },
				itemStyle: { color: '#4f46e5' }
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
	<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
		<li class="flex items-center gap-1.5">
			<span class="h-0.5 w-4 bg-rose-600"></span>Avg high (°C)
		</li>
		<li class="flex items-center gap-1.5">
			<span class="h-0.5 w-4 bg-indigo-600"></span>Avg low (°C)
		</li>
		<li class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-sm bg-sky-200"></span>Precipitation (mm)
		</li>
	</ul>
</div>
