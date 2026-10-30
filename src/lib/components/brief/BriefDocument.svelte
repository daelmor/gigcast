<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Badge from '../ui/Badge.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import { STATUS_LABEL, STATUS_TONE, VERDICT_LABEL, VERDICT_TONE } from '../ui/tones';
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
	import { formatDate } from './format';
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

	// Highlight the section nearest the top of the viewport in the table of contents.
	let active = $state<string>();
	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		const visible = new SvelteSet<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) visible.add(e.target.id);
					else visible.delete(e.target.id);
				}
				// First in document order wins when several sections are on screen.
				active = toc.find((t) => visible.has(t.id))?.id ?? active;
			},
			{ rootMargin: '-15% 0px -70% 0px' }
		);
		for (const t of toc) {
			const el = document.getElementById(t.id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	});
</script>

<article
	class="mx-auto w-full max-w-6xl px-4 py-space-5 sm:px-6 lg:grid lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-space-6"
>
	<aside class="hidden lg:block">
		<nav class="sticky top-space-5" aria-label="Brief sections">
			<p class="mb-space-2 type-label text-ink-subtle">On this page</p>
			<ul class="space-y-0.5 border-l border-line">
				{#each toc as item (item.id)}
					{@const current = active === item.id}
					<li>
						<a
							href="#{item.id}"
							aria-current={current ? 'location' : undefined}
							class="-ml-px block border-l py-1 pl-space-3 type-small transition-colors duration-[120ms] hover:text-signal {current
								? 'border-signal text-signal'
								: 'border-transparent text-ink-muted'}"
						>
							<span class="block">{item.title}</span>
							{#if item.label}
								<EvidenceLabel label={item.label} bare class="mt-0.5 opacity-90" />
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</aside>

	<div
		class="min-w-0 space-y-space-7 rounded-lg border border-line bg-surface-raised p-space-5 sm:p-space-6 lg:p-space-7 print:rounded-none print:border-0 print:p-0"
	>
		<header>
			<p class="type-label text-ink-subtle">Booking Brief</p>
			<h1 class="mt-space-2 type-heading-1 text-ink sm:type-display">
				{draft.headline}
			</h1>
			<p class="mt-space-3 type-body-lg text-ink-muted">
				{resolution.artist.name || brief.input.artist}
				<span aria-hidden="true">→</span><span class="sr-only">in</span>
				{brief.input.city}, {brief.input.country}
			</p>
			<p class="mt-space-1 type-small text-ink-subtle tabular-nums">
				{formatDate(brief.input.dateFrom)} to {formatDate(brief.input.dateTo)} · created {formatDate(
					brief.createdAt
				)}
			</p>
			<div class="mt-space-4 flex flex-wrap items-center gap-space-2">
				<Badge tone={VERDICT_TONE[draft.verdict]}>{VERDICT_LABEL[draft.verdict]}</Badge>
				<Badge tone={STATUS_TONE[brief.run.status]}
					><span class="sr-only">Run </span>{STATUS_LABEL[brief.run.status]}</Badge
				>
			</div>

			<dl
				class="mt-space-5 grid gap-space-3 border-t border-line pt-space-4 type-small sm:grid-cols-2"
			>
				<div>
					<dt class="type-label text-ink-subtle">Artist</dt>
					<dd class="mt-space-1 text-ink">
						{resolution.artist.name}
						{#if resolution.artist.disambiguation}
							<span class="text-ink-muted">· {resolution.artist.disambiguation}</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt class="type-label text-ink-subtle">Locality</dt>
					<dd class="mt-space-1 text-ink">
						{resolution.locality.name ?? brief.input.city}
						<span class="text-ink-muted">· {locationMethod[resolution.locality.method]}</span>
						{#if resolution.locality.disambiguation}
							<span class="block text-ink-subtle">{resolution.locality.disambiguation}</span>
						{/if}
					</dd>
				</div>
			</dl>

			<div class="mt-space-5 border-t border-line pt-space-4">
				<h2 class="type-heading-3 text-ink">Key points</h2>
				<ul class="mt-space-3 space-y-space-2">
					{#each draft.keyPoints as point, i (i)}
						<li class="flex gap-space-3 type-body text-ink">
							<span class="mt-[9px] size-1.5 shrink-0 rounded-full bg-signal" aria-hidden="true"
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
