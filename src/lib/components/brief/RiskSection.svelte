<script lang="ts">
	import Label from '../ui/Label.svelte';
	import AdvisoryCard from '../risk/AdvisoryCard.svelte';
	import CategoryBadge from '../risk/CategoryBadge.svelte';
	import ClimateCard from '../risk/ClimateCard.svelte';
	import ExternalLink from '../risk/ExternalLink.svelte';
	import HolidayList from '../risk/HolidayList.svelte';
	import RiskScoreCard from '../risk/RiskScoreCard.svelte';
	import SeverityDots from '../risk/SeverityDots.svelte';
	import { categoryLabel } from '../risk/labels';
	import SectionHeader from './SectionHeader.svelte';
	import { RISK_UNAVAILABLE, formatDate } from './format';
	import type { Brief, SectionNote } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const risks = $derived(brief.draft.risks);
	const feed = $derived(brief.artifacts.riskFeed);
	const calendar = $derived(brief.artifacts.marketCalendar);
	const hasLayer = $derived(feed !== undefined || calendar !== undefined);
	const unavailable = $derived(!hasLayer && (!risks || risks.note.label === 'no_coverage'));

	const note = $derived<SectionNote>(
		risks?.note ?? {
			label: 'no_coverage',
			summary: 'The agent did not write a risk section for this brief.',
			caveats: []
		}
	);

	const groups = $derived(
		[...new Set((risks?.items ?? []).map((i) => i.category))].map((category) => ({
			category,
			items: (risks?.items ?? [])
				.filter((i) => i.category === category)
				.sort((a, b) => b.severity - a.severity)
		}))
	);

	const holidays = $derived((calendar?.holidays ?? []).filter((h) => h.inWindow));
	const longWeekends = $derived((calendar?.longWeekends ?? []).filter((w) => w.inWindow));
	const advisories = $derived(feed?.advisories ?? []);
	const hasContext = $derived(calendar !== undefined || advisories.length > 0);
</script>

<section aria-labelledby="risks">
	{#if unavailable}
		<div class="mb-5 flex flex-wrap items-center gap-3">
			<h2 id="risks" class="text-zinc-900 scroll-mt-24 text-xl font-semibold">Risk panel</h2>
			<Label label="no_coverage" size="md" />
		</div>
		<div class="border-zinc-300 bg-zinc-50 rounded-xl border border-dashed p-6 text-center">
			<svg
				class="text-zinc-400 mx-auto size-8"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
				/>
			</svg>
			<p class="text-zinc-900 mt-3 font-medium">The risk layer is not part of this build yet</p>
			{#if risks}<p class="text-zinc-600 mx-auto mt-1 max-w-xl text-sm">
					{risks.note.summary}
				</p>{/if}
			<p class="text-zinc-500 mx-auto mt-2 max-w-xl text-xs">{RISK_UNAVAILABLE}</p>
		</div>
	{:else}
		<SectionHeader id="risks" title="Risk panel" {note} />
		<div class="space-y-6">
			{#if feed}
				<RiskScoreCard score={feed.score} />
			{/if}
			{#if groups.length === 0}
				<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
					{#if feed && feed.items.length > 0}
						The agent reported no notable risks; {feed.items.length} classified {feed.items
							.length === 1
							? 'item was'
							: 'items were'} available.
					{:else}
						No risk items were reported.
					{/if}
				</p>
			{:else}
				{#each groups as group (group.category)}
					<div>
						<h3 class="text-zinc-500 mb-2 text-sm font-semibold tracking-wide uppercase">
							{categoryLabel(group.category)}
						</h3>
						<ul class="space-y-3">
							{#each group.items as item, i (i)}
								<li class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
									<div class="flex flex-wrap items-center gap-2">
										<CategoryBadge category={item.category} />
										<SeverityDots severity={item.severity} />
									</div>
									<h4 class="text-zinc-900 mt-2 font-semibold">
										<ExternalLink
											href={item.sourceUrl}
											class="hover:text-indigo-700 hover:underline">{item.title}</ExternalLink
										>
									</h4>
									<p class="text-zinc-700 mt-1 text-sm">{item.soWhat}</p>
									<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
										<ExternalLink href={item.sourceUrl} class="text-indigo-600 hover:underline"
											>{item.sourceName}</ExternalLink
										>
										{#if item.publishedAt}
											<span class="text-zinc-500">{formatDate(item.publishedAt)}</span>
										{/if}
										<Label label={item.label} />
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			{/if}

			{#if hasContext}
				<div>
					<h3 class="text-zinc-500 mb-2 text-sm font-semibold tracking-wide uppercase">Context</h3>
					<div class="grid gap-4 lg:grid-cols-2">
						{#if calendar}
							<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
								<h4 class="text-zinc-900 mb-3 font-semibold">
									Calendar, {formatDate(calendar.from)} to {formatDate(calendar.to)}
								</h4>
								<HolidayList {holidays} {longWeekends} />
							</div>
							<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
								<h4 class="text-zinc-900 mb-3 font-semibold">Climate for your dates</h4>
								{#if calendar.climate}
									<ClimateCard climate={calendar.climate} />
								{:else}
									<p class="text-zinc-500 text-sm">No climate normals were available.</p>
								{/if}
							</div>
						{/if}
					</div>
					{#if advisories.length > 0}
						<h4 class="text-zinc-900 mt-4 mb-2 font-semibold">Travel advisories</h4>
						<ul class="grid gap-3 lg:grid-cols-2">
							{#each advisories as advisory, i (i)}
								<li><AdvisoryCard {advisory} /></li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
			{#if feed && feed.ingestedAt}
				<p class="text-zinc-500 text-xs">
					News last ingested {formatDate(feed.ingestedAt)}; {feed.storedItems} items stored for this market.
				</p>
			{/if}
		</div>
	{/if}
</section>
