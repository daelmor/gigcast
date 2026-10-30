<script lang="ts">
	import Badge from '../ui/Badge.svelte';
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import { riskLevel } from '../ui/tones';
	import AdvisoryCard from '../risk/AdvisoryCard.svelte';
	import ClimateCard from '../risk/ClimateCard.svelte';
	import ExternalLink from '../risk/ExternalLink.svelte';
	import HolidayList from '../risk/HolidayList.svelte';
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

	const level = $derived(feed ? riskLevel(feed.score.value) : undefined);
	const BAR: Record<string, string> = {
		positive: 'bg-positive',
		caution: 'bg-caution',
		critical: 'bg-critical'
	};
	const cats = $derived(
		feed
			? Object.entries(feed.score.byCategory)
					.filter(([, v]) => v > 0)
					.sort((a, b) => b[1] - a[1])
			: []
	);
</script>

<section aria-labelledby="risks">
	{#if unavailable}
		<header class="mb-space-5 border-b border-line pb-space-4">
			<p class="mb-space-1 type-label text-ink-subtle">Section 8 · Risk</p>
			<div class="flex flex-wrap items-center gap-x-space-3 gap-y-space-2">
				<h2 id="risks" class="scroll-mt-24 type-heading-1 text-ink">Risk panel</h2>
				<EvidenceLabel label="no_coverage" />
			</div>
		</header>
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
					d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
				/>
			</svg>
			<p class="mt-space-3 type-body font-semibold text-ink">
				The risk layer is not part of this build yet
			</p>
			{#if risks}<p class="mx-auto mt-space-1 max-w-xl type-small text-ink-muted">
					{risks.note.summary}
				</p>{/if}
			<p class="mx-auto mt-space-2 max-w-xl type-small text-ink-subtle">{RISK_UNAVAILABLE}</p>
		</div>
	{:else}
		<SectionHeader id="risks" kicker="Section 8 · Risk" title="Risk panel" {note} />
		<div class="space-y-space-5">
			{#if feed && level}
				<Card class="break-inside-avoid">
					<div class="flex flex-wrap items-baseline justify-between gap-space-2">
						<p class="type-label text-ink-subtle">Market risk score</p>
						<p class="type-small text-ink-muted tabular-nums">
							<span class="font-semibold text-ink">{feed.score.itemCount}</span> items,
							<span class="font-semibold text-ink">{feed.score.recentCount}</span> from the last 7 days
						</p>
					</div>
					<div class="mt-space-2 flex flex-wrap items-center gap-space-3">
						<span class="type-numeral text-ink tabular-nums">{feed.score.value}</span>
						<span class="type-small text-ink-subtle">/ 100</span>
						<Badge tone={level.tone} class="capitalize">{level.word}</Badge>
					</div>
					<div
						class="mt-space-3 h-2 overflow-hidden rounded-pill bg-surface-sunken"
						role="meter"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={feed.score.value}
						aria-label="Market risk score, {level.word}"
					>
						<div
							class="h-full rounded-pill {BAR[level.tone]}"
							style:width="{feed.score.value}%"
						></div>
					</div>
					{#if cats.length > 0}
						<ul class="mt-space-4 flex flex-wrap gap-space-2" aria-label="Score by category">
							{#each cats as [category, value] (category)}
								<li>
									<Chip
										>{categoryLabel(category)}
										<span class="ml-1.5 tabular-nums">{value}</span></Chip
									>
								</li>
							{/each}
						</ul>
					{/if}
					<p class="mt-space-3 type-small text-ink-subtle">
						Recent, severe items weigh more; older items decay. It is a news-volume signal, not a
						safety judgment.
					</p>
				</Card>
			{/if}
			{#if groups.length === 0}
				<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
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
						<h3 class="mb-space-2 type-label text-ink-subtle">
							{categoryLabel(group.category)}
						</h3>
						<ul class="space-y-space-3">
							{#each group.items as item, i (i)}
								<Card as="li" class="break-inside-avoid">
									<div class="flex flex-wrap items-center gap-space-2">
										<Chip>{categoryLabel(item.category)}</Chip>
										<SeverityDots severity={item.severity} />
									</div>
									<h4 class="mt-space-2 type-heading-3 text-ink">
										<ExternalLink href={item.sourceUrl} class="hover:text-signal hover:underline"
											>{item.title}</ExternalLink
										>
									</h4>
									<p class="mt-space-1 type-body text-ink-muted">{item.soWhat}</p>
									<div
										class="mt-space-3 flex flex-wrap items-center gap-x-space-3 gap-y-space-1 type-small"
									>
										<ExternalLink
											href={item.sourceUrl}
											class="font-semibold text-signal hover:underline"
											>{item.sourceName}</ExternalLink
										>
										{#if item.publishedAt}
											<span class="text-ink-subtle tabular-nums"
												>{formatDate(item.publishedAt)}</span
											>
										{/if}
										<EvidenceLabel label={item.label} />
									</div>
								</Card>
							{/each}
						</ul>
					</div>
				{/each}
			{/if}

			{#if hasContext}
				<div>
					<h3 class="mb-space-2 type-label text-ink-subtle">Context</h3>
					<div class="grid gap-space-4 lg:grid-cols-2">
						{#if calendar}
							<Card class="break-inside-avoid">
								<h4 class="mb-space-3 type-heading-3 text-ink">
									Calendar, {formatDate(calendar.from)} to {formatDate(calendar.to)}
								</h4>
								<HolidayList {holidays} {longWeekends} />
							</Card>
							<Card class="break-inside-avoid">
								<h4 class="mb-space-3 type-heading-3 text-ink">Climate for your dates</h4>
								{#if calendar.climate}
									<ClimateCard climate={calendar.climate} />
								{:else}
									<p class="type-small text-ink-muted">No climate normals were available.</p>
								{/if}
							</Card>
						{/if}
					</div>
					{#if advisories.length > 0}
						<h4 class="mt-space-4 mb-space-2 type-heading-3 text-ink">Travel advisories</h4>
						<ul class="grid gap-space-3 lg:grid-cols-2">
							{#each advisories as advisory, i (i)}
								<li class="break-inside-avoid"><AdvisoryCard {advisory} /></li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
			{#if feed && feed.ingestedAt}
				<p class="type-small text-ink-subtle">
					News last ingested {formatDate(feed.ingestedAt)}; {feed.storedItems} items stored for this market.
				</p>
			{/if}
		</div>
	{/if}
</section>
