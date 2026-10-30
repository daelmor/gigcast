<script lang="ts">
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
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
	<SectionHeader
		id="audience"
		kicker="Section 1 · Audience"
		title="Audience map"
		note={audience.note}
	/>

	{#if hasMap && heatmap}
		<Card padded={false} class="break-inside-avoid p-space-3">
			{#if heatmap.hasDimensions}
				<div
					class="mb-space-3 flex flex-wrap gap-space-2 print:hidden"
					role="group"
					aria-label="Map dimension"
				>
					{#each DIMENSIONS as d (d.id)}
						<Chip pressed={dimension === d.id} onclick={() => (dimension = d.id)}>{d.title}</Chip>
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
			<div class="mt-space-3 flex items-baseline gap-space-3 px-space-1">
				<span class="type-numeral text-ink tabular-nums">{heatmap.cells.length}</span>
				<p class="type-small text-ink-subtle">
					heatmap cells <SourceMarks sources={[heatmap.source.toolCallId]} />. Cells are coarse
					geohashes, not venue-level data.
				</p>
			</div>
		</Card>
	{:else}
		<div
			class="rounded-lg border border-dashed border-line-strong bg-surface-sunken p-space-5 text-center"
		>
			<svg
				class="mx-auto size-8 text-ink-subtle"
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
			<p
				class="mt-space-3 flex flex-wrap items-center justify-center gap-space-2 type-body font-semibold text-ink"
			>
				No heatmap for this market <EvidenceLabel label="no_coverage" />
			</p>
			<p class="mx-auto mt-space-1 max-w-xl type-small text-ink-muted">
				The taste graph returned no audience cells for this artist and locality, so there is nothing
				to map.
			</p>
			<p class="mx-auto mt-space-2 max-w-xl type-small text-ink-subtle">{audience.note.summary}</p>
		</div>
	{/if}

	<div class="mt-space-5 grid gap-space-5 md:grid-cols-2">
		<div>
			<h3 class="mb-space-2 type-heading-3 text-ink">Hotspots</h3>
			{#if audience.hotspots.length === 0}
				<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
					No hotspots were identified.
				</p>
			{:else}
				<ul class="space-y-space-3">
					{#each audience.hotspots as h, i (i)}
						<Card as="li" class="break-inside-avoid">
							<p class="type-heading-3 text-ink">{h.name}</p>
							<p class="mt-space-1 type-body text-ink-muted">{h.why}</p>
							<div class="mt-space-3 flex flex-wrap items-center gap-space-2">
								<EvidenceLabel label={h.label} />
								<SourceMarks sources={h.sources} />
							</div>
						</Card>
					{/each}
				</ul>
			{/if}
		</div>
		<div>
			<h3 class="mb-space-2 type-heading-3 text-ink">Top neighbourhoods</h3>
			{#if hoods.length === 0}
				<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
					No neighbourhood ranking was available.
				</p>
			{:else}
				<Card class="break-inside-avoid">
					<ul class="space-y-space-3">
						{#each hoods as h (h.entityId)}
							<li>
								<div class="flex justify-between gap-space-2 type-small">
									<span class="truncate text-ink">{h.name}</span>
									<span class="text-ink-muted tabular-nums">{pct(h.affinity)}</span>
								</div>
								<div class="mt-1 h-2 overflow-hidden rounded-pill bg-surface-sunken">
									<div
										class="h-full rounded-pill bg-chart-1"
										style:width="{(h.affinity / hoodMax) * 100}%"
									></div>
								</div>
							</li>
						{/each}
					</ul>
					{#if brief.artifacts.neighbourhoods}
						<p class="mt-space-3 type-small text-ink-subtle">
							<SourceMarks sources={[brief.artifacts.neighbourhoods.source.toolCallId]} />
						</p>
					{/if}
				</Card>
			{/if}
		</div>
	</div>
</section>
