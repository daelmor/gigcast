<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDateTime } from '../brief/format';
	import RecentBriefs from '../shell/RecentBriefs.svelte';
	import Button from '../ui/Button.svelte';
	import Card from '../ui/Card.svelte';
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

<div class="mx-auto max-w-6xl space-y-space-7 px-4 py-space-6 sm:px-6">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-0">
			<p class="type-label text-ink-subtle">Market dashboard</p>
			<h1 class="mt-space-1 type-heading-1 sm:type-display">{market.name}</h1>
			<p class="mt-space-2 type-small text-ink-muted">
				{market.countryName} · {market.localityName} · {market.timezone}
			</p>
			<p class="mt-space-1 type-small text-ink-subtle">
				{#if feed.ingestedAt}Last ingested {formatDateTime(feed.ingestedAt)}{:else}Nothing ingested
					yet{/if}
				· {feed.storedItems} items stored
			</p>
			{#if market.outlets.length > 0}
				<p
					class="mt-space-2 flex flex-wrap items-center gap-x-3 gap-y-1 type-small text-ink-subtle"
				>
					<span>Outlets:</span>
					{#each market.outlets as o, i (i)}
						<ExternalLink href={o.url} class="text-signal hover:underline">{o.name}</ExternalLink>
					{/each}
				</p>
			{/if}
		</div>
		<Button variant="primary" href="{resolve('/new')}?market={market.id}"
			>New brief for this market</Button
		>
	</header>

	<section aria-labelledby="score">
		<h2 id="score" class="sr-only">Risk score</h2>
		<RiskScoreCard score={feed.score} />
	</section>

	<section aria-labelledby="news" class="space-y-4">
		<h2 id="news" class="type-heading-2">Classified news</h2>
		{#if feed.items.length === 0}
			<p class="rounded-lg bg-surface-sunken p-space-6 text-center type-small text-ink-muted">
				No classified news for this market yet. Items appear after the next ingestion run.
			</p>
		{:else}
			<FeedFilters bind:filters {available} />
			<p class="type-small text-ink-subtle" aria-live="polite">
				Showing {visible.length} of {filtered.length}
				{filtered.length === 1 ? 'item' : 'items'}, heaviest first.
			</p>
			{#if filtered.length === 0}
				<p class="rounded-lg bg-surface-sunken p-space-6 text-center type-small text-ink-muted">
					No items match these filters.
				</p>
			{:else}
				<ul class="space-y-space-3">
					{#each visible as item, i (i)}
						<NewsItemCard {item} />
					{/each}
				</ul>
				{#if filtered.length > visible.length}
					<Button size="sm" onclick={() => (shown += PAGE)}>Show more</Button>
				{/if}
			{/if}
		{/if}
	</section>

	<section aria-labelledby="advisories" class="space-y-4">
		<h2 id="advisories" class="type-heading-2">Travel advisories</h2>
		{#if feed.advisories.length === 0}
			<p class="rounded-lg bg-surface-sunken p-space-6 text-center type-small text-ink-muted">
				No travel advisories on file for {market.countryName}.
			</p>
		{:else}
			<ul class="grid gap-space-3 lg:grid-cols-2">
				{#each feed.advisories as advisory, i (i)}
					<li><AdvisoryCard {advisory} /></li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="calendar" class="space-y-4">
		<h2 id="calendar" class="type-heading-2">Calendar and climate</h2>
		<div class="grid gap-4 lg:grid-cols-2">
			<Card>
				<h3 class="mb-space-3 type-heading-3">Next six months</h3>
				<HolidayList holidays={calendar.holidays} longWeekends={calendar.longWeekends} />
			</Card>
			<Card>
				<h3 class="mb-space-3 type-heading-3">Monthly climate normals</h3>
				{#if calendar.climateMonths.length > 0}
					<ClimateChart months={calendar.climateMonths} />
				{:else}
					<p class="type-small text-ink-muted">No climate normals available for this market.</p>
				{/if}
			</Card>
		</div>
	</section>

	<section aria-labelledby="briefs" class="space-y-4">
		<h2 id="briefs" class="type-heading-2">Recent briefs for this market</h2>
		{#if dashboard.recentBriefs.length === 0}
			<p class="rounded-lg bg-surface-sunken p-space-6 text-center type-small text-ink-muted">
				No briefs for {market.name} yet.
				<a
					href="{resolve('/new')}?market={market.id}"
					class="font-medium text-signal hover:underline">Make the first one.</a
				>
			</p>
		{:else}
			<RecentBriefs briefs={dashboard.recentBriefs} />
		{/if}
	</section>
</div>
