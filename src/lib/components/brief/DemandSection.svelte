<script lang="ts">
	import { onMount } from 'svelte';
	import { theme, watchTheme, withAlpha } from '$lib/client/theme-colors.svelte';
	import Label from '../ui/Label.svelte';
	import EChart from './EChart.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import SourceMarks from './SourceMarks.svelte';
	import { ordinal, pct, words } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const d = $derived(brief.draft.demandAndFit);
	const a = $derived(brief.artifacts);

	const trendIds = $derived(a.trending ? [a.trending.source.toolCallId] : []);
	const tasteIds = $derived(
		[a.artistTags?.source.toolCallId, a.cityTags?.source.toolCallId].filter((x): x is string => !!x)
	);
	const demoIds = $derived(a.demographics ? [a.demographics.source.toolCallId] : []);

	const trendMeta = {
		rising: { arrow: '↗', text: 'Rising', cls: 'text-emerald-700 bg-emerald-50' },
		flat: { arrow: '→', text: 'Flat', cls: 'text-zinc-700 bg-zinc-100' },
		falling: { arrow: '↘', text: 'Falling', cls: 'text-rose-700 bg-rose-50' },
		unknown: { arrow: '?', text: 'Unknown', cls: 'text-zinc-500 bg-zinc-100' }
	} as const;

	const trendPoints = $derived(
		(a.trending?.items ?? []).filter(
			(p): p is typeof p & { percentile: number } => p.percentile !== null
		)
	);

	onMount(() => watchTheme());
	const c = $derived(theme.colors);

	const sparkOption = $derived({
		grid: { left: 4, right: 4, top: 6, bottom: 4 },
		xAxis: { type: 'category', show: false, data: trendPoints.map((p) => p.date) },
		yAxis: { type: 'value', show: false, min: 0, max: 1 },
		tooltip: {
			trigger: 'axis',
			valueFormatter: (v: unknown) => `${Math.round(Number(v) * 100)}th percentile`
		},
		series: [
			{
				type: 'line',
				data: trendPoints.map((p) => p.percentile),
				smooth: true,
				symbolSize: 5,
				lineStyle: { color: c['chart-1'], width: 2 },
				itemStyle: { color: c['chart-1'] },
				areaStyle: { color: withAlpha(c['chart-1'], 0.1) }
			}
		]
	});

	const AGE_TITLES: Record<string, string> = {
		'24_and_younger': '24 and under',
		'25_to_29': '25 to 29',
		'30_to_34': '30 to 34',
		'35_to_44': '35 to 44',
		'45_to_54': '45 to 54',
		'55_and_older': '55 and over'
	};

	function barOption(entries: [string, number][], title: (k: string) => string) {
		const max = Math.max(0.01, ...entries.map(([, v]) => Math.abs(v)));
		return {
			grid: { left: 90, right: 36, top: 4, bottom: 4 },
			tooltip: { trigger: 'item', valueFormatter: (v: unknown) => Number(v).toFixed(2) },
			xAxis: { type: 'value', show: false, min: -max, max },
			yAxis: {
				type: 'category',
				inverse: true,
				data: entries.map(([k]) => title(k)),
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { color: c['ink-muted'], fontSize: 12, fontFamily: theme.fonts.sans }
			},
			series: [
				{
					type: 'bar',
					barWidth: 12,
					label: {
						show: true,
						position: 'right',
						color: c['ink-muted'],
						fontSize: 11,
						fontFamily: theme.fonts.mono,
						formatter: (p: { value: number }) => p.value.toFixed(2)
					},
					data: entries.map(([, v]) => ({
						value: v,
						itemStyle: { color: v < 0 ? c['chart-muted'] : c['chart-1'], borderRadius: 3 }
					}))
				}
			]
		};
	}

	const ageEntries = $derived(Object.entries(a.demographics?.age ?? {}));
	const genderEntries = $derived(Object.entries(a.demographics?.gender ?? {}));
	const ageOption = $derived(barOption(ageEntries, (k) => AGE_TITLES[k] ?? words(k)));
	const genderOption = $derived(
		barOption(genderEntries, (k) => k.charAt(0).toUpperCase() + k.slice(1))
	);
</script>

<section aria-labelledby="demand">
	<SectionHeader id="demand" title="Demand and fit" note={d.note} />
	<div class="grid gap-4 md:grid-cols-2">
		<!-- Popularity -->
		<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
			<h3 class="text-zinc-900 text-sm font-semibold">Popularity</h3>
			{#if d.popularity !== undefined}
				<p class="text-zinc-900 mt-2 text-3xl font-semibold tabular-nums">
					{ordinal(d.popularity * 100)}<span class="text-zinc-500 text-base font-normal">
						percentile</span
					>
				</p>
				<div class="bg-zinc-100 mt-2 h-1.5 overflow-hidden rounded-full">
					<div class="bg-indigo-600 h-full rounded-full" style:width={pct(d.popularity)}></div>
				</div>
				<p class="text-zinc-500 mt-2 text-xs">
					Share of Qloo entities of this kind that the artist out-ranks.
				</p>
			{:else}
				<p class="text-zinc-500 mt-2 text-sm">No popularity figure was available.</p>
			{/if}
		</div>

		<!-- Trend -->
		<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
			<div class="flex items-center justify-between gap-2">
				<h3 class="text-zinc-900 text-sm font-semibold">Trend</h3>
				{#if d.trend}
					<span class="flex items-center gap-2"
						><Label label={d.trend.label} /><SourceMarks sources={trendIds} /></span
					>
				{/if}
			</div>
			{#if d.trend}
				{@const meta = trendMeta[d.trend.direction]}
				<div class="mt-2 flex items-center gap-2">
					<span
						class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium {meta.cls}"
						><span aria-hidden="true">{meta.arrow}</span>{meta.text}</span
					>
				</div>
				<p class="text-zinc-700 mt-2 text-sm">{d.trend.detail}</p>
				{#if trendPoints.length > 1}
					<EChart
						class="mt-2 h-16 w-full"
						option={sparkOption}
						fallback="Trend over time: {trendPoints
							.map((p) => `${p.date} ${pct(p.percentile)}`)
							.join(', ')}"
					/>
				{/if}
			{:else}
				<p class="text-zinc-500 mt-2 text-sm">No trend data was available for this artist.</p>
			{/if}
		</div>

		<!-- Demographics -->
		<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1 md:col-span-2">
			<div class="flex items-center justify-between gap-2">
				<h3 class="text-zinc-900 text-sm font-semibold">Audience demographics</h3>
				{#if d.demographics}
					<span class="flex items-center gap-2"
						><Label label={d.demographics.label} /><SourceMarks sources={demoIds} /></span
					>
				{/if}
			</div>
			{#if a.demographics && (ageEntries.length > 0 || genderEntries.length > 0)}
				<p class="text-zinc-500 mt-1 text-xs">
					Affinity relative to the average audience. Zinc bars are under-indexed, indigo
					over-indexed.
				</p>
				<div class="mt-2 grid gap-4 md:grid-cols-2">
					<div>
						<p class="text-zinc-500 text-xs font-medium uppercase">Age</p>
						<EChart
							class="h-44 w-full"
							option={ageOption}
							fallback="Age affinity: {ageEntries.map(([k, v]) => `${k} ${v}`).join(', ')}"
						/>
					</div>
					<div>
						<p class="text-zinc-500 text-xs font-medium uppercase">Gender</p>
						<EChart
							class="h-20 w-full"
							option={genderOption}
							fallback="Gender affinity: {genderEntries.map(([k, v]) => `${k} ${v}`).join(', ')}"
						/>
						{#if d.demographics}
							<p class="text-zinc-700 mt-2 text-sm">
								Gender skew: <span class="font-medium">{d.demographics.genderSkew}</span>.
								{#if d.demographics.topAgeBuckets.length > 0}
									Top age buckets: {d.demographics.topAgeBuckets
										.map((b) => AGE_TITLES[b] ?? words(b))
										.join(', ')}.
								{/if}
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<p class="text-zinc-500 mt-2 text-sm">Qloo returned no demographic data for this artist.</p>
			{/if}
		</div>

		<!-- Taste match -->
		<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1 md:col-span-2">
			<div class="flex items-center justify-between gap-2">
				<h3 class="text-zinc-900 text-sm font-semibold">Taste match with the city</h3>
				{#if d.tasteMatch}
					<span class="flex items-center gap-2"
						><Label label={d.tasteMatch.label} /><SourceMarks sources={tasteIds} /></span
					>
				{/if}
			</div>
			{#if d.tasteMatch}
				<div class="mt-2 flex flex-wrap items-start gap-4">
					{#if d.tasteMatch.score !== undefined}
						<p class="text-zinc-900 text-3xl font-semibold tabular-nums">
							{pct(d.tasteMatch.score)}
						</p>
					{/if}
					<div class="min-w-0 flex-1 basis-64">
						<p class="text-zinc-700 text-sm">{d.tasteMatch.detail}</p>
						{#if d.tasteMatch.sharedTags.length > 0}
							<div class="mt-2 flex flex-wrap gap-1.5">
								{#each d.tasteMatch.sharedTags as tag, i (i)}
									<span class="bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5 text-xs"
										>{tag}</span
									>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<p class="text-zinc-500 mt-2 text-sm">No taste comparison was available.</p>
			{/if}
		</div>
	</div>
</section>
