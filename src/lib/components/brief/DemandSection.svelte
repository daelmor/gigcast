<script lang="ts">
	import { onMount } from 'svelte';
	import { theme, watchTheme, withAlpha } from '$lib/client/theme-colors.svelte';
	import Badge from '../ui/Badge.svelte';
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import type { Tone } from '../ui/tones';
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

	const trendMeta: Record<string, { arrow: string; text: string; tone: Tone }> = {
		rising: { arrow: '↗', text: 'Rising', tone: 'positive' },
		flat: { arrow: '→', text: 'Flat', tone: 'neutral' },
		falling: { arrow: '↘', text: 'Falling', tone: 'critical' },
		unknown: { arrow: '?', text: 'Unknown', tone: 'neutral' }
	};

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
	<SectionHeader id="demand" kicker="Section 2 · Demand" title="Demand and fit" note={d.note} />
	<div class="grid gap-space-4 md:grid-cols-2">
		<!-- Popularity -->
		<Card class="break-inside-avoid">
			<h3 class="type-heading-3 text-ink">Popularity</h3>
			{#if d.popularity !== undefined}
				<p class="mt-space-3 type-numeral text-ink tabular-nums">
					{ordinal(d.popularity * 100)}<span class="type-body text-ink-muted"> percentile</span>
				</p>
				<div class="mt-space-3 h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
					<div class="h-full rounded-pill bg-chart-1" style:width={pct(d.popularity)}></div>
				</div>
				<p class="mt-space-3 type-small text-ink-subtle">
					Share of entities of this kind in the taste graph that the artist out-ranks.
				</p>
			{:else}
				<p class="mt-space-2 type-small text-ink-muted">No popularity figure was available.</p>
			{/if}
		</Card>

		<!-- Trend -->
		<Card class="break-inside-avoid">
			<div class="flex flex-wrap items-center justify-between gap-space-2">
				<h3 class="type-heading-3 text-ink">Trend</h3>
				{#if d.trend}
					<span class="flex items-center gap-space-2"
						><EvidenceLabel label={d.trend.label} /><SourceMarks sources={trendIds} /></span
					>
				{/if}
			</div>
			{#if d.trend}
				{@const meta = trendMeta[d.trend.direction] ?? trendMeta.unknown}
				<div class="mt-space-3">
					<Badge tone={meta.tone}><span aria-hidden="true">{meta.arrow}</span>{meta.text}</Badge>
				</div>
				<p class="mt-space-3 type-body text-ink-muted">{d.trend.detail}</p>
				{#if trendPoints.length > 1}
					<EChart
						class="mt-space-2 h-16 w-full"
						option={sparkOption}
						fallback="Trend over time: {trendPoints
							.map((p) => `${p.date} ${pct(p.percentile)}`)
							.join(', ')}"
					/>
				{/if}
			{:else}
				<p class="mt-space-2 type-small text-ink-muted">
					No trend data was available for this artist.
				</p>
			{/if}
		</Card>

		<!-- Demographics -->
		<Card class="break-inside-avoid md:col-span-2">
			<div class="flex flex-wrap items-center justify-between gap-space-2">
				<h3 class="type-heading-3 text-ink">Audience demographics</h3>
				{#if d.demographics}
					<span class="flex items-center gap-space-2"
						><EvidenceLabel label={d.demographics.label} /><SourceMarks sources={demoIds} /></span
					>
				{/if}
			</div>
			{#if a.demographics && (ageEntries.length > 0 || genderEntries.length > 0)}
				<p class="mt-space-1 type-small text-ink-subtle">
					Affinity relative to the average audience. Muted bars are under-indexed, solid bars
					over-indexed.
				</p>
				<div class="mt-space-3 grid gap-space-4 md:grid-cols-2">
					<div>
						<p class="type-label text-ink-subtle">Age</p>
						<EChart
							class="h-44 w-full"
							option={ageOption}
							fallback="Age affinity: {ageEntries.map(([k, v]) => `${k} ${v}`).join(', ')}"
						/>
					</div>
					<div>
						<p class="type-label text-ink-subtle">Gender</p>
						<EChart
							class="h-20 w-full"
							option={genderOption}
							fallback="Gender affinity: {genderEntries.map(([k, v]) => `${k} ${v}`).join(', ')}"
						/>
						{#if d.demographics}
							<p class="mt-space-2 type-body text-ink-muted">
								Gender skew: <span class="font-semibold text-ink">{d.demographics.genderSkew}</span
								>.
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
				<p class="mt-space-2 type-small text-ink-muted">
					The taste graph returned no demographic data for this artist.
				</p>
			{/if}
		</Card>

		<!-- Taste match -->
		<Card class="break-inside-avoid md:col-span-2">
			<div class="flex flex-wrap items-center justify-between gap-space-2">
				<h3 class="type-heading-3 text-ink">Taste match with the city</h3>
				{#if d.tasteMatch}
					<span class="flex items-center gap-space-2"
						><EvidenceLabel label={d.tasteMatch.label} /><SourceMarks sources={tasteIds} /></span
					>
				{/if}
			</div>
			{#if d.tasteMatch}
				<div class="mt-space-3 flex flex-wrap items-start gap-space-4">
					{#if d.tasteMatch.score !== undefined}
						<p class="type-numeral text-ink tabular-nums">{pct(d.tasteMatch.score)}</p>
					{/if}
					<div class="min-w-0 flex-1 basis-64">
						<p class="type-body text-ink-muted">{d.tasteMatch.detail}</p>
						{#if d.tasteMatch.sharedTags.length > 0}
							<div class="mt-space-3 flex flex-wrap gap-space-2">
								{#each d.tasteMatch.sharedTags as tag, i (i)}
									<Chip>{tag}</Chip>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<p class="mt-space-2 type-small text-ink-muted">No taste comparison was available.</p>
			{/if}
		</Card>
	</div>
</section>
