<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, Card, Chip, EvidenceLabel } from '$lib/components/ui';
	import ExternalLink from '$lib/components/risk/ExternalLink.svelte';
	import Architecture from '$lib/components/about/Architecture.svelte';
	import { LABEL_HELP, type Label as LabelKind } from '$lib/brief/schema';

	const toc = [
		{ id: 'what', title: 'What it is' },
		{ id: 'qloo', title: 'Why Qloo is load-bearing' },
		{ id: 'labels', title: 'The three labels' },
		{ id: 'architecture', title: 'Architecture' },
		{ id: 'sources', title: 'Data sources' },
		{ id: 'honesty', title: 'Honesty notes' },
		{ id: 'links', title: 'Links' }
	];

	const parts = [
		'Audience map',
		'Demand and fit',
		'Lineup',
		'Sponsors',
		'Venues and partners',
		'Pricing',
		'Risk panel',
		'Counterfactual panel',
		'Agent trace'
	];

	const endpoints: { name: string; gives: string }[] = [
		{
			name: '/search',
			gives:
				'Resolves artists, brands and localities to Qloo entities. Localities are checked against the country, so "Panama City" does not resolve to Panama City, Florida.'
		},
		{
			name: '/v2/insights, filter.type=urn:heatmap',
			gives:
				'Geohash cells with affinity, popularity, quality and price-level dimensions. This is the audience map.'
		},
		{
			name: 'urn:entity:artist with signal.location',
			gives: 'Lineup candidates that over-index in the city.'
		},
		{
			name: '/v2/insights/compare',
			gives: 'The shared tags behind a pairing of headliner and support act.'
		},
		{
			name: 'urn:entity:brand',
			gives: 'Sponsor candidates, also filtered by the dominant age bucket.'
		},
		{
			name: 'urn:entity:place with filter.location and place tags',
			gives: 'Venues, bars, hotels and restaurants near the heat.'
		},
		{ name: 'urn:demographics', gives: 'Age and gender affinities of the audience.' },
		{ name: 'urn:tag', gives: 'Tags for the artist and for the city, used for the taste match.' },
		{ name: '/v2/trending', gives: 'The twelve-month trend for the artist.' }
	];

	const labels: LabelKind[] = ['grounded', 'inferred', 'no_coverage'];

	const sources: { source: string; take: string; terms: string }[] = [
		{
			source: 'Qloo',
			take: 'Taste, heatmap, demographics, trending and entity data.',
			terms: 'Hackathon API access.'
		},
		{
			source: 'Google News RSS',
			take: 'Headlines and links.',
			terms: 'Never article bodies.'
		},
		{
			source: 'Local outlet RSS feeds',
			take: 'Headlines and links from local outlets per market.',
			terms: 'Never article bodies.'
		},
		{ source: 'Nager.Date', take: 'Public holidays.', terms: 'Public API.' },
		{
			source: 'Open-Meteo ERA5 archive',
			take: 'Historical weather and climate.',
			terms: 'CC BY 4.0.'
		},
		{
			source: 'US State Department, UK FCDO',
			take: 'Travel advisories.',
			terms: 'Public.'
		},
		{
			source: 'OpenFreeMap tiles',
			take: 'Base map for the heatmap.',
			terms: 'OpenMapTiles and OpenStreetMap attribution shown on the map.'
		}
	];

	const honesty = [
		'Affinity is an audience-overlap signal. It is not a ticket forecast.',
		'Demographics are affinities relative to the general population, not headcounts.',
		'Pricing is a heuristic, not a quote or a revenue forecast.',
		'Risk classification is a model reading headlines. It is not a safety assessment.',
		'Briefs are public read-only links. Anyone with the link can read the brief.'
	];

	let active = $state(toc[0].id);

	$effect(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		let visible: string[] = [];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) visible = [...visible, e.target.id];
					else visible = visible.filter((id) => id !== e.target.id);
				}
				// The topmost visible section in document order is the active one.
				const first = toc.find((t) => visible.includes(t.id));
				if (first) active = first.id;
			},
			{ rootMargin: '-10% 0px -70% 0px' }
		);
		for (const t of toc) {
			const el = document.getElementById(t.id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	});
</script>

<svelte:head><title>About gigcast</title></svelte:head>

<div class="lg:grid lg:grid-cols-[12rem_1fr] lg:gap-space-7">
	<nav class="hidden lg:block" aria-label="On this page">
		<ol class="sticky top-24 space-y-space-1 type-small">
			{#each toc as t (t.id)}
				<li>
					<a
						href="#{t.id}"
						aria-current={active === t.id ? 'location' : undefined}
						class="block rounded-sm px-space-3 py-1.5 no-underline transition-colors duration-[120ms] hover:bg-surface-sunken {active ===
						t.id
							? 'font-semibold text-signal'
							: 'text-ink-muted hover:text-ink'}">{t.title}</a
					>
				</li>
			{/each}
		</ol>
	</nav>

	<article class="min-w-0 space-y-space-7">
		<header>
			<p class="type-label text-ink-subtle">About</p>
			<h1 class="mt-space-2 type-heading-1 sm:type-display">About gigcast</h1>
			<p class="mt-space-3 max-w-2xl type-body-lg text-ink-muted">
				What a Booking Brief is, how Qloo grounds it, and where it stops being reliable.
			</p>
		</header>

		<section id="what" class="scroll-mt-24">
			<p class="type-label text-ink-subtle">Overview</p>
			<h2 class="mt-space-1 type-heading-1">What it is</h2>
			<Card class="mt-space-4 space-y-space-3 type-body">
				<p>
					Concert promoters often decide on gut feel: which city, which support act, which sponsor,
					which price. The data that would help is spread across ticket history, social numbers and
					local knowledge, and none of it says who the audience is or where they live.
				</p>
				<p>
					gigcast turns an artist, a city and dates into a Booking Brief with nine parts:
					{parts.join(', ').toLowerCase()}. Each claim is labeled grounded, inferred or no coverage.
					It is for promoters, talent buyers and venue bookers who need a first read on a market
					before they commit money, and want to see what each claim rests on.
				</p>
				<ul class="flex flex-wrap gap-space-2 pt-space-1">
					{#each parts as p (p)}
						<li><Chip>{p}</Chip></li>
					{/each}
				</ul>
			</Card>
		</section>

		<section id="qloo" class="scroll-mt-24">
			<p class="type-label text-ink-subtle">Data</p>
			<h2 class="mt-space-1 type-heading-1">Why Qloo is load-bearing</h2>
			<Card class="mt-space-4 space-y-space-4 type-body">
				<p>
					Qloo's Taste AI is one affinity graph across artists, brands, places, localities and
					demographics. One graph means a brief can answer "who likes this artist, where do they
					live, what do they buy, where do they go" with results that connect to each other. These
					are the endpoints the agent uses.
				</p>
				<dl class="divide-y divide-line overflow-hidden rounded-md border border-line">
					{#each endpoints as e (e.name)}
						<div class="grid sm:grid-cols-[18rem_1fr]">
							<dt class="bg-surface-sunken px-space-4 py-space-3 type-data break-words text-ink">
								{e.name}
							</dt>
							<dd class="px-space-4 py-space-3 type-small text-ink-muted">{e.gives}</dd>
						</div>
					{/each}
				</dl>
				<h3 class="pt-space-2 type-heading-3">The counterfactual</h3>
				<p>
					Ask the same question without tools and a model returns plausible names that nobody can
					verify. The brief shows both columns side by side: the tool-backed answer and the LLM-only
					answer. Every name in the LLM-only column is checked against what Qloo returned in the
					tool-backed run, so the reader sees which names the graph supports and which it does not.
				</p>
			</Card>
		</section>

		<section id="labels" class="scroll-mt-24">
			<p class="type-label text-ink-subtle">Evidence</p>
			<h2 class="mt-space-1 type-heading-1">The three labels</h2>
			<ul class="mt-space-4 grid gap-space-5 md:grid-cols-3">
				{#each labels as l (l)}
					<Card as="li">
						<EvidenceLabel label={l} />
						<p class="mt-space-3 type-small text-ink-muted">{LABEL_HELP[l]}</p>
					</Card>
				{/each}
			</ul>
			<p class="mt-space-4 max-w-3xl type-body">
				The server checks grounded picks. An entity id must appear in a tool result of the same run,
				and a risk item must cite a url that the risk feed returned. A pick that fails the check is
				not shown as grounded.
			</p>
		</section>

		<section id="architecture" class="scroll-mt-24">
			<p class="type-label text-ink-subtle">System</p>
			<h2 class="mt-space-1 type-heading-1">Architecture</h2>
			<Card class="mt-space-4">
				<Architecture />
			</Card>
		</section>

		<section id="sources" class="scroll-mt-24">
			<p class="type-label text-ink-subtle">Provenance</p>
			<h2 class="mt-space-1 type-heading-1">Data sources</h2>
			<div class="mt-space-4 overflow-x-auto rounded-lg border border-line bg-surface-raised">
				<table class="w-full min-w-[32rem] text-left type-small">
					<thead>
						<tr>
							<th class="bg-surface-sunken px-space-4 py-space-3 type-label text-ink-muted"
								>Source</th
							>
							<th class="bg-surface-sunken px-space-4 py-space-3 type-label text-ink-muted"
								>What we take</th
							>
							<th class="bg-surface-sunken px-space-4 py-space-3 type-label text-ink-muted"
								>Terms note</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-line text-ink-muted">
						{#each sources as s (s.source)}
							<tr>
								<td class="px-space-4 py-space-3 font-semibold text-ink">{s.source}</td>
								<td class="px-space-4 py-space-3">{s.take}</td>
								<td class="px-space-4 py-space-3">{s.terms}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-space-3 type-small text-ink-muted">
				We store headlines and links, never article bodies. Nothing is sent to sponsors.
			</p>
		</section>

		<section id="honesty" class="scroll-mt-24">
			<p class="type-label text-ink-subtle">Limits</p>
			<h2 class="mt-space-1 type-heading-1">Honesty notes</h2>
			<Card class="mt-space-4">
				<ul class="list-disc space-y-space-2 pl-space-5 type-body">
					{#each honesty as h (h)}
						<li>{h}</li>
					{/each}
				</ul>
			</Card>
		</section>

		<section id="links" class="scroll-mt-24">
			<p class="type-label text-ink-subtle">Elsewhere</p>
			<h2 class="mt-space-1 type-heading-1">Links</h2>
			<Card class="mt-space-4">
				<ul class="space-y-space-2 type-body text-signal">
					<li>
						<ExternalLink href="https://github.com/daelmor/gigcast" class="hover:underline"
							>Repository</ExternalLink
						>
					</li>
					<li>
						<ExternalLink
							href="https://github.com/daelmor/gigcast/blob/main/STATUS.md"
							class="hover:underline">STATUS.md</ExternalLink
						>
					</li>
					<li>
						<ExternalLink
							href="https://github.com/daelmor/gigcast/blob/main/docs/decisions.md"
							class="hover:underline">docs/decisions.md</ExternalLink
						>
					</li>
				</ul>
			</Card>
			<Button variant="primary" href={resolve('/new')} class="mt-space-5">Start a brief</Button>
		</section>
	</article>
</div>
