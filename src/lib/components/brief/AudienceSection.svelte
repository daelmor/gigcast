<script lang="ts">
	import Label from '../ui/Label.svelte';
	import HeatmapMap, { type Dimension, type MapPoint } from './HeatmapMap.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import SourceMarks from './SourceMarks.svelte';
	import { pct } from './format';
	import { KNOWN_MARKETS } from '$lib/markets';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const audience = $derived(brief.draft.audience);
	const heatmap = $derived(brief.artifacts.heatmap);
	const hasMap = $derived(!!heatmap && heatmap.cells.length > 0);

	let dimension = $state<Dimension>('affinity');

	const DIMENSIONS: { id: Dimension; title: string }[] = [
		{ id: 'affinity', title: 'Affinity' },
		{ id: 'popularity', title: 'Popularity' },
		{ id: 'quality', title: 'Quality' },
		{ id: 'priceLevel', title: 'Price level' }
	];

	const center = $derived.by((): [number, number] => {
		const loc = brief.resolution.locality;
		if (loc.lat !== undefined && loc.lon !== undefined) return [loc.lon, loc.lat];
		const m = KNOWN_MARKETS[0];
		return [m.lon, m.lat];
	});

	const hotspotPoints = $derived<MapPoint[]>(
		audience.hotspots.map((h) => ({ name: h.name, why: h.why, lat: h.lat, lon: h.lon }))
	);
	const venuePoints = $derived<MapPoint[]>(
		brief.draft.venuesAndPartners.picks.flatMap((p) =>
			p.lat !== undefined && p.lon !== undefined
				? [{ name: p.name, why: p.why, lat: p.lat, lon: p.lon }]
				: []
		)
	);

	const hoods = $derived(
		[...(brief.artifacts.neighbourhoods?.items ?? [])]
			.sort((a, b) => b.affinity - a.affinity)
			.slice(0, 8)
	);
	const hoodMax = $derived(Math.max(0.01, ...hoods.map((h) => h.affinity)));
</script>

<section aria-labelledby="audience">
	<SectionHeader id="audience" title="Audience map" note={audience.note} />

	{#if hasMap && heatmap}
		<div class="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
			{#if heatmap.hasDimensions}
				<div
					class="mb-3 inline-flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1"
					role="group"
					aria-label="Map dimension"
				>
					{#each DIMENSIONS as d (d.id)}
						<button
							type="button"
							onclick={() => (dimension = d.id)}
							aria-pressed={dimension === d.id}
							class="rounded-md px-3 py-1 text-sm font-medium {dimension === d.id
								? 'bg-white text-indigo-700 shadow-sm'
								: 'text-zinc-600 hover:text-zinc-900'}">{d.title}</button
						>
					{/each}
				</div>
			{/if}
			<HeatmapMap
				cells={heatmap.cells}
				{dimension}
				hotspots={hotspotPoints}
				venues={venuePoints}
				{center}
			/>
			<p class="mt-2 text-xs text-zinc-500">
				{heatmap.cells.length} heatmap cells <SourceMarks sources={[heatmap.source.toolCallId]} />.
				Cells are coarse geohashes, not venue-level data.
			</p>
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
			<svg
				class="mx-auto size-8 text-zinc-400"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 6.75V15m6-6v8.25m.5 3.5-6.5-3-5.5 2.5V6l5.5-2.5 6.5 3 5.5-2.5v11.75l-5.5 2.5Z"
				/>
			</svg>
			<p class="mt-3 flex flex-wrap items-center justify-center gap-2 font-medium text-zinc-900">
				No heatmap for this market <Label label="no_coverage" />
			</p>
			<p class="mx-auto mt-1 max-w-xl text-sm text-zinc-600">
				Qloo returned no audience cells for this artist and locality, so there is nothing to map.
			</p>
			<p class="mx-auto mt-2 max-w-xl text-xs text-zinc-500">{audience.note.summary}</p>
		</div>
	{/if}

	<div class="mt-5 grid gap-5 md:grid-cols-2">
		<div>
			<h3 class="mb-2 text-sm font-semibold text-zinc-900">Hotspots</h3>
			{#if audience.hotspots.length === 0}
				<p class="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
					No hotspots were identified.
				</p>
			{:else}
				<ul class="space-y-3">
					{#each audience.hotspots as h, i (i)}
						<li class="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
							<p class="font-medium text-zinc-900">{h.name}</p>
							<p class="mt-1 text-sm text-zinc-700">{h.why}</p>
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<Label label={h.label} />
								<SourceMarks sources={h.sources} />
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<div>
			<h3 class="mb-2 text-sm font-semibold text-zinc-900">Top neighbourhoods</h3>
			{#if hoods.length === 0}
				<p class="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
					No neighbourhood ranking was available.
				</p>
			{:else}
				<ul class="space-y-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
					{#each hoods as h (h.entityId)}
						<li>
							<div class="flex justify-between gap-2 text-sm">
								<span class="truncate text-zinc-800">{h.name}</span>
								<span class="text-zinc-500 tabular-nums">{pct(h.affinity)}</span>
							</div>
							<div class="mt-0.5 h-2 overflow-hidden rounded-full bg-zinc-100">
								<div
									class="h-full rounded-full bg-indigo-500"
									style:width="{(h.affinity / hoodMax) * 100}%"
								></div>
							</div>
						</li>
					{/each}
				</ul>
				{#if brief.artifacts.neighbourhoods}
					<p class="mt-1 text-xs text-zinc-500">
						<SourceMarks sources={[brief.artifacts.neighbourhoods.source.toolCallId]} />
					</p>
				{/if}
			{/if}
		</div>
	</div>
</section>
