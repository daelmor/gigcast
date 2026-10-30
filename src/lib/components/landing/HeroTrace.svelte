<script lang="ts">
	/**
	 * Static, decorative excerpt of the agent trace (TraceLine spec): the product at work.
	 * Tool names and summaries are taken from the sample run in brief/fixtures/sample-events.ts.
	 */
	import { Badge } from '$lib/components/ui';

	const lines: { tool: string; arg: string; live?: boolean }[] = [
		{ tool: 'qloo_heatmap', arg: '855 heatmap cells, price-level dimensions available' },
		{ tool: 'qloo_audience_demographics', arg: '6 age buckets, 2 gender values (cache hit)' },
		{ tool: 'qloo_trending', arg: '3 weekly points, latest percentile 0.93' },
		{ tool: 'qloo_city_taste', arg: '10 city tags' },
		{ tool: 'qloo_artist_tags', arg: '10 artist tags (cache hit)' },
		{ tool: 'qloo_similar_artists', arg: '10 similar artists with explainability' },
		{ tool: 'qloo_brand_affinities', arg: '20 brands, top: Adidas (0.91)' },
		{ tool: 'qloo_places_near', arg: '50 bars near the locality' },
		{ tool: 'qloo_places_near', arg: '50 hotels near the locality (cache hit)' },
		{ tool: 'risk_feed', arg: 'reading headlines for the dates', live: true }
	];
</script>

<div
	class="overflow-hidden rounded-lg border border-line bg-surface-sunken p-space-4"
	aria-hidden="true"
>
	<div class="mb-space-3 flex items-center justify-between">
		<span class="type-label text-ink-subtle">Agent trace</span>
		<Badge tone="live">Running</Badge>
	</div>
	<ul class="space-y-space-2">
		{#each lines as l, i (i)}
			<li class="flex items-center gap-space-3 overflow-hidden type-data whitespace-nowrap">
				<span
					class="size-2 shrink-0 rounded-full {l.live
						? 'animate-pulse-live bg-beam'
						: 'bg-grounded'}"
				></span>
				<span class="shrink-0 text-beam-text">{l.tool}</span>
				<span class="min-w-0 truncate text-ink-subtle">{l.arg}</span>
			</li>
		{/each}
	</ul>
</div>
