<script lang="ts">
	import AudienceSection from './AudienceSection.svelte';
	import CounterfactualSection from './CounterfactualSection.svelte';
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
		{ id: 'counterfactual', title: 'LLM only vs. Qloo' },
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
			<p class="text-zinc-500 mb-2 text-xs font-semibold tracking-wide uppercase">On this page</p>
			<ul class="border-zinc-200 space-y-0.5 border-l">
				{#each toc as item (item.id)}
					<li>
						<a
							href="#{item.id}"
							class="text-zinc-600 hover:border-indigo-600 hover:text-indigo-700 -ml-px flex items-center gap-2 border-l border-transparent py-1 pl-3 text-sm"
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
		<header class="bg-white ring-zinc-200 rounded-xl p-5 ring-1 sm:p-6">
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
			<h1 class="text-zinc-900 mt-3 text-2xl leading-tight font-semibold sm:text-3xl">
				{draft.headline}
			</h1>
			<p class="text-zinc-700 mt-2 text-base">
				{resolution.artist.name || brief.input.artist}
				<span aria-hidden="true">→</span><span class="sr-only">in</span>
				{brief.input.city}, {brief.input.country}
			</p>
			<p class="text-zinc-500 mt-1 text-sm">
				{formatDate(brief.input.dateFrom)} to {formatDate(brief.input.dateTo)} · created {formatDate(
					brief.createdAt
				)}
			</p>

			<dl class="border-zinc-100 mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-zinc-500 text-xs font-medium uppercase">Artist</dt>
					<dd class="text-zinc-800">
						{resolution.artist.name}
						{#if resolution.artist.disambiguation}
							<span class="text-zinc-500">· {resolution.artist.disambiguation}</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-zinc-500 text-xs font-medium uppercase">Locality</dt>
					<dd class="text-zinc-800">
						{resolution.locality.name ?? brief.input.city}
						<span class="text-zinc-500">· {locationMethod[resolution.locality.method]}</span>
						{#if resolution.locality.disambiguation}
							<span class="text-zinc-500 block text-xs">{resolution.locality.disambiguation}</span>
						{/if}
					</dd>
				</div>
			</dl>

			<div class="border-zinc-100 mt-4 border-t pt-4">
				<h2 class="text-zinc-900 text-sm font-semibold">Key points</h2>
				<ul class="mt-2 space-y-2">
					{#each draft.keyPoints as point, i (i)}
						<li class="text-zinc-800 flex gap-2.5 text-sm leading-relaxed">
							<span class="bg-indigo-600 mt-2 size-1.5 shrink-0 rounded-full" aria-hidden="true"
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
		<CounterfactualSection {brief} />
		<VenuesSection {brief} />
		<PricingSection {brief} />
		<RiskSection {brief} />
		<OpenQuestions {brief} />
		<MethodSection {brief} />
		<SourcesList {brief} />
	</div>
</article>
