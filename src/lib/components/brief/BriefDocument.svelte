<script lang="ts">
	import AudienceSection from './AudienceSection.svelte';
	import DemandSection from './DemandSection.svelte';
	import LineupSection from './LineupSection.svelte';
	import MethodSection from './MethodSection.svelte';
	import OpenQuestions from './OpenQuestions.svelte';
	import PricingSection from './PricingSection.svelte';
	import RiskSection from './RiskSection.svelte';
	import SourcesList from './SourcesList.svelte';
	import SponsorsSection from './SponsorsSection.svelte';
	import VenuesSection from './VenuesSection.svelte';
	import { setSourceIndex } from './context';
	import { formatDate, words } from './format';
	import { buildSourceIndex } from './sources';
	import type { Brief, Label } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const index = $derived(buildSourceIndex(brief));
	// Sections read the index through context; it is rebuilt when the brief prop changes.
	setSourceIndex({
		get order() {
			return index.order;
		},
		get indexByCallId() {
			return index.indexByCallId;
		}
	});

	const { resolution } = $derived(brief);
	const draft = $derived(brief.draft);

	const verdictStyles = {
		promising: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
		mixed: 'bg-amber-50 text-amber-900 ring-amber-600/25',
		weak: 'bg-rose-50 text-rose-800 ring-rose-600/25',
		insufficient_data: 'bg-zinc-100 text-zinc-700 ring-zinc-500/25'
	} as const;
	const statusStyles = {
		complete: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
		partial: 'bg-amber-50 text-amber-900 ring-amber-600/25',
		failed: 'bg-rose-50 text-rose-800 ring-rose-600/25'
	} as const;
	const dotStyles: Record<Label, string> = {
		grounded: 'bg-emerald-500',
		inferred: 'bg-amber-500',
		no_coverage: 'bg-zinc-400'
	};

	const locationMethod = {
		entity_id: 'matched by Qloo locality id',
		point: 'matched by coordinates',
		unresolved: 'not resolved'
	} as const;

	const toc = $derived<{ id: string; title: string; label?: Label }[]>([
		{ id: 'audience', title: 'Audience map', label: draft.audience.note.label },
		{ id: 'demand', title: 'Demand and fit', label: draft.demandAndFit.note.label },
		{ id: 'lineup', title: 'Lineup', label: draft.lineup.note.label },
		{ id: 'sponsors', title: 'Sponsors', label: draft.sponsors.note.label },
		{ id: 'venues', title: 'Venues and partners', label: draft.venuesAndPartners.note.label },
		{ id: 'pricing', title: 'Pricing guidance', label: draft.pricing.note.label },
		{ id: 'risks', title: 'Risk panel', label: draft.risks?.note.label ?? 'no_coverage' },
		{ id: 'questions', title: 'Open questions' },
		{ id: 'method', title: 'Method' },
		{ id: 'sources', title: 'Sources' }
	]);
</script>

<article
	class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10"
>
	<aside class="hidden lg:block">
		<nav class="sticky top-6" aria-label="Brief sections">
			<p class="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">On this page</p>
			<ul class="space-y-0.5 border-l border-zinc-200">
				{#each toc as item (item.id)}
					<li>
						<a
							href="#{item.id}"
							class="-ml-px flex items-center gap-2 border-l border-transparent py-1 pl-3 text-sm text-zinc-600 hover:border-indigo-600 hover:text-indigo-700"
						>
							{#if item.label}
								<span
									class="size-1.5 shrink-0 rounded-full {dotStyles[item.label]}"
									aria-hidden="true"
								></span>
							{:else}
								<span class="size-1.5 shrink-0" aria-hidden="true"></span>
							{/if}
							{item.title}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</aside>

	<div class="min-w-0 space-y-12">
		<header class="rounded-xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ring-1 ring-inset {verdictStyles[
						draft.verdict
					]}">{words(draft.verdict)}</span
				>
				<span
					class="rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset {statusStyles[
						brief.run.status
					]}">Run {brief.run.status}</span
				>
			</div>
			<h1 class="mt-3 text-2xl leading-tight font-semibold text-zinc-900 sm:text-3xl">
				{draft.headline}
			</h1>
			<p class="mt-2 text-base text-zinc-700">
				{resolution.artist.name || brief.input.artist}
				<span aria-hidden="true">→</span><span class="sr-only">in</span>
				{brief.input.city}, {brief.input.country}
			</p>
			<p class="mt-1 text-sm text-zinc-500">
				{formatDate(brief.input.dateFrom)} to {formatDate(brief.input.dateTo)} · created {formatDate(
					brief.createdAt
				)}
			</p>

			<dl class="mt-4 grid gap-3 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-xs font-medium text-zinc-500 uppercase">Artist</dt>
					<dd class="text-zinc-800">
						{resolution.artist.name}
						{#if resolution.artist.disambiguation}
							<span class="text-zinc-500">· {resolution.artist.disambiguation}</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-xs font-medium text-zinc-500 uppercase">Locality</dt>
					<dd class="text-zinc-800">
						{resolution.locality.name ?? brief.input.city}
						<span class="text-zinc-500">· {locationMethod[resolution.locality.method]}</span>
						{#if resolution.locality.disambiguation}
							<span class="block text-xs text-zinc-500">{resolution.locality.disambiguation}</span>
						{/if}
					</dd>
				</div>
			</dl>

			<div class="mt-4 border-t border-zinc-100 pt-4">
				<h2 class="text-sm font-semibold text-zinc-900">Key points</h2>
				<ul class="mt-2 space-y-2">
					{#each draft.keyPoints as point, i (i)}
						<li class="flex gap-2.5 text-sm leading-relaxed text-zinc-800">
							<span class="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-600" aria-hidden="true"
							></span>
							<span>{point}</span>
						</li>
					{/each}
				</ul>
			</div>
		</header>

		<AudienceSection {brief} />
		<DemandSection {brief} />
		<LineupSection {brief} />
		<SponsorsSection {brief} />
		<VenuesSection {brief} />
		<PricingSection {brief} />
		<RiskSection {brief} />
		<OpenQuestions {brief} />
		<MethodSection {brief} />
		<SourcesList {brief} />
	</div>
</article>
