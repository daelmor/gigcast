<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDateTime } from '../brief/format';
	import RecentBriefs from '../shell/RecentBriefs.svelte';
	import AdvisoryCard from './AdvisoryCard.svelte';
	import ClimateChart from './ClimateChart.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import FeedFilters from './FeedFilters.svelte';
	import HolidayList from './HolidayList.svelte';
	import NewsItemCard from './NewsItemCard.svelte';
	import RiskScoreCard from './RiskScoreCard.svelte';
	import { DEFAULT_FILTERS, filterItems, type FeedFilterState } from './filter';
	import type { MarketDashboard } from '$lib/api/contracts';

	let { dashboard }: { dashboard: MarketDashboard } = $props();

	const PAGE = 30;
	const market = $derived(dashboard.market);
	const feed = $derived(dashboard.feed);
	const calendar = $derived(dashboard.calendar);

	let filters = $state<FeedFilterState>({ ...DEFAULT_FILTERS, categories: [] });
	let shown = $state(PAGE);

	const sorted = $derived([...feed.items].sort((a, b) => b.weight - a.weight));
	const filtered = $derived(filterItems(sorted, filters));
	const visible = $derived(filtered.slice(0, shown));
	const available = $derived([...new Set(feed.items.map((i) => i.category))]);

	// Changing a filter starts the list from the top again.
	$effect(() => {
		void [
			filters.categories.length,
			filters.minSeverity,
			filters.days,
			filters.mentionsSubjectOnly
		];
		shown = PAGE;
	});
</script>

<div class="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-0">
			<p class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Market dashboard</p>
			<h1 class="text-2xl font-semibold text-zinc-900">{market.name}</h1>
			<p class="mt-1 text-sm text-zinc-600">
				{market.countryName} · {market.localityName} · {market.timezone}
			</p>
			<p class="mt-1 text-xs text-zinc-500">
				{#if feed.ingestedAt}Last ingested {formatDateTime(feed.ingestedAt)}{:else}Nothing ingested
					yet{/if}
				· {feed.storedItems} items stored
			</p>
			{#if market.outlets.length > 0}
				<p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
					<span>Outlets:</span>
					{#each market.outlets as o, i (i)}
						<ExternalLink href={o.url} class="text-indigo-600 hover:underline"
							>{o.name}</ExternalLink
						>
					{/each}
				</p>
			{/if}
		</div>
		<a
			href="{resolve('/new')}?market={market.id}"
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
			>New brief for this market</a
		>
	</header>

	<section aria-labelledby="score">
		<h2 id="score" class="sr-only">Risk score</h2>
		<RiskScoreCard score={feed.score} />
	</section>

	<section aria-labelledby="news" class="space-y-4">
		<h2 id="news" class="text-xl font-semibold text-zinc-900">Classified news</h2>
		{#if feed.items.length === 0}
			<p class="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-600 ring-1 ring-zinc-200">
				No classified news for this market yet. Items appear after the next ingestion run.
			</p>
		{:else}
			<FeedFilters bind:filters {available} />
			<p class="text-sm text-zinc-600" aria-live="polite">
				Showing {visible.length} of {filtered.length}
				{filtered.length === 1 ? 'item' : 'items'}, heaviest first.
			</p>
			{#if filtered.length === 0}
				<p class="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-600 ring-1 ring-zinc-200">
					No items match these filters.
				</p>
			{:else}
				<ul class="space-y-3">
					{#each visible as item, i (i)}
						<li><NewsItemCard {item} /></li>
					{/each}
				</ul>
				{#if filtered.length > visible.length}
					<button
						type="button"
						onclick={() => (shown += PAGE)}
						class="rounded-lg px-4 py-2 text-sm font-medium text-indigo-700 ring-1 ring-indigo-600/30 hover:bg-indigo-50"
						>Show more</button
					>
				{/if}
			{/if}
		{/if}
	</section>

	<section aria-labelledby="advisories" class="space-y-4">
		<h2 id="advisories" class="text-xl font-semibold text-zinc-900">Travel advisories</h2>
		{#if feed.advisories.length === 0}
			<p class="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-600 ring-1 ring-zinc-200">
				No travel advisories on file for {market.countryName}.
			</p>
		{:else}
			<ul class="grid gap-3 lg:grid-cols-2">
				{#each feed.advisories as advisory, i (i)}
					<li><AdvisoryCard {advisory} /></li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="calendar" class="space-y-4">
		<h2 id="calendar" class="text-xl font-semibold text-zinc-900">Calendar and climate</h2>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
				<h3 class="mb-3 font-semibold text-zinc-900">Next six months</h3>
				<HolidayList holidays={calendar.holidays} longWeekends={calendar.longWeekends} />
			</div>
			<div class="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
				<h3 class="mb-3 font-semibold text-zinc-900">Monthly climate normals</h3>
				{#if calendar.climateMonths.length > 0}
					<ClimateChart months={calendar.climateMonths} />
				{:else}
					<p class="text-sm text-zinc-500">No climate normals available for this market.</p>
				{/if}
			</div>
		</div>
	</section>

	<section aria-labelledby="briefs" class="space-y-4">
		<h2 id="briefs" class="text-xl font-semibold text-zinc-900">Recent briefs for this market</h2>
		{#if dashboard.recentBriefs.length === 0}
			<p class="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-600 ring-1 ring-zinc-200">
				No briefs for {market.name} yet.
				<a
					href="{resolve('/new')}?market={market.id}"
					class="font-medium text-indigo-600 hover:underline">Make the first one.</a
				>
			</p>
		{:else}
			<RecentBriefs briefs={dashboard.recentBriefs} />
		{/if}
	</section>
</div>
