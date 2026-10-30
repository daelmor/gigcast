<script lang="ts">
	import { resolve } from '$app/paths';
	import Label from '$lib/components/ui/Label.svelte';
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

	const card = 'rounded-xl bg-white p-6 ring-1 ring-zinc-200';
</script>

<svelte:head><title>About gigcast</title></svelte:head>

<div class="lg:grid lg:grid-cols-[12rem_1fr] lg:gap-10">
	<nav class="hidden lg:block" aria-label="On this page">
		<ol class="sticky top-6 space-y-1 text-sm">
			{#each toc as t (t.id)}
				<li>
					<a
						href="#{t.id}"
						class="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 block rounded-lg px-3 py-1.5"
						>{t.title}</a
					>
				</li>
			{/each}
		</ol>
	</nav>

	<article class="min-w-0 space-y-12">
		<header>
			<h1 class="text-zinc-900 text-4xl font-semibold tracking-tight">About gigcast</h1>
			<p class="text-zinc-600 mt-3 max-w-2xl text-lg">
				What a Booking Brief is, how Qloo grounds it, and where it stops being reliable.
			</p>
		</header>

		<section id="what" class="scroll-mt-6">
			<h2 class="text-xl font-semibold">What it is</h2>
			<div class="{card} text-zinc-700 mt-4 space-y-3">
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
				<ul class="flex flex-wrap gap-2 pt-1">
					{#each parts as p (p)}
						<li class="bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-1 text-xs">{p}</li>
					{/each}
				</ul>
			</div>
		</section>

		<section id="qloo" class="scroll-mt-6">
			<h2 class="text-xl font-semibold">Why Qloo is load-bearing</h2>
			<div class="{card} text-zinc-700 mt-4 space-y-4">
				<p>
					Qloo's Taste AI is one affinity graph across artists, brands, places, localities and
					demographics. One graph means a brief can answer "who likes this artist, where do they
					live, what do they buy, where do they go" with results that connect to each other. These
					are the endpoints the agent uses.
				</p>
				<dl class="divide-zinc-200 ring-zinc-200 divide-y rounded-lg ring-1">
					{#each endpoints as e (e.name)}
						<div class="grid gap-1 px-4 py-3 sm:grid-cols-[18rem_1fr] sm:gap-4">
							<dt class="text-zinc-900 font-mono text-sm break-words">{e.name}</dt>
							<dd class="text-zinc-600 text-sm">{e.gives}</dd>
						</div>
					{/each}
				</dl>
				<h3 class="text-zinc-900 pt-2 font-semibold">The counterfactual</h3>
				<p>
					Ask the same question without tools and a model returns plausible names that nobody can
					verify. The brief shows both columns side by side: the tool-backed answer and the LLM-only
					answer. Every name in the LLM-only column is checked against what Qloo returned in the
					tool-backed run, so the reader sees which names the graph supports and which it does not.
				</p>
			</div>
		</section>

		<section id="labels" class="scroll-mt-6">
			<h2 class="text-xl font-semibold">The three labels</h2>
			<ul class="mt-4 grid gap-4 md:grid-cols-3">
				{#each labels as l (l)}
					<li class={card}>
						<Label label={l} size="md" />
						<p class="text-zinc-600 mt-3 text-sm">{LABEL_HELP[l]}</p>
					</li>
				{/each}
			</ul>
			<p class="text-zinc-700 mt-4 max-w-3xl">
				The server checks grounded picks. An entity id must appear in a tool result of the same run,
				and a risk item must cite a url that the risk feed returned. A pick that fails the check is
				not shown as grounded.
			</p>
		</section>

		<section id="architecture" class="scroll-mt-6">
			<h2 class="text-xl font-semibold">Architecture</h2>
			<div class="{card} mt-4">
				<Architecture />
			</div>
		</section>

		<section id="sources" class="scroll-mt-6">
			<h2 class="text-xl font-semibold">Data sources</h2>
			<div class="bg-white ring-zinc-200 mt-4 overflow-x-auto rounded-xl ring-1">
				<table class="w-full min-w-[32rem] text-left text-sm">
					<thead class="border-zinc-200 text-zinc-500 border-b">
						<tr>
							<th class="px-4 py-3 font-medium">Source</th>
							<th class="px-4 py-3 font-medium">What we take</th>
							<th class="px-4 py-3 font-medium">Terms note</th>
						</tr>
					</thead>
					<tbody class="divide-zinc-200 text-zinc-700 divide-y">
						{#each sources as s (s.source)}
							<tr>
								<td class="text-zinc-900 px-4 py-3 font-medium">{s.source}</td>
								<td class="px-4 py-3">{s.take}</td>
								<td class="px-4 py-3">{s.terms}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-zinc-600 mt-3 text-sm">
				We store headlines and links, never article bodies. Nothing is sent to sponsors.
			</p>
		</section>

		<section id="honesty" class="scroll-mt-6">
			<h2 class="text-xl font-semibold">Honesty notes</h2>
			<ul class="{card} text-zinc-700 mt-4 list-disc space-y-2 pl-10">
				{#each honesty as h (h)}
					<li>{h}</li>
				{/each}
			</ul>
		</section>

		<section id="links" class="scroll-mt-6">
			<h2 class="text-xl font-semibold">Links</h2>
			<ul class="{card} text-indigo-600 mt-4 space-y-2">
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
			<a
				href={resolve('/new')}
				class="bg-indigo-600 text-white hover:bg-indigo-700 mt-6 inline-block rounded-lg px-5 py-2.5 font-medium shadow-sm"
				>Start a brief</a
			>
		</section>
	</article>
</div>
