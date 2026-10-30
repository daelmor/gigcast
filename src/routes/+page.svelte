<script lang="ts">
	import { resolve } from '$app/paths';
	import { FEATURED_MARKETS } from '$lib/markets';
	import ExampleBriefs from '$lib/components/landing/ExampleBriefs.svelte';
	import RecentBriefs from '$lib/components/shell/RecentBriefs.svelte';

	let { data } = $props();

	const steps = [
		'Pick artist, city, dates.',
		'The agent calls Qloo and streams its trace.',
		'Read, share or print the brief.'
	];
</script>

<svelte:head><title>gigcast · Booking Briefs grounded in Qloo</title></svelte:head>

<section class="py-6 sm:py-10">
	<h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
		Booking Briefs grounded in Qloo
	</h1>
	<p class="mt-5 max-w-2xl text-lg text-zinc-600">
		A promoter picks an artist, a city and dates. The agent maps the audience, scores demand and
		fit, proposes a lineup, sponsors, venues and ticket tiers, and labels every claim grounded,
		inferred or no coverage.
	</p>
	<a
		href={resolve('/new')}
		class="mt-8 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-indigo-700"
		>Start a brief</a
	>
</section>

<section class="mt-10 rounded-xl bg-white p-6 ring-1 ring-zinc-200">
	<h2 class="text-lg font-semibold">Why Qloo</h2>
	<p class="mt-2 max-w-3xl text-zinc-600">
		Qloo's Taste AI links artists, brands, places and neighbourhoods through one affinity graph.
		That is what lets a brief say where an artist's audience lives, which brands they over-index on
		and which venues sit in the heat, with the Qloo result behind every claim. Everything else in
		the brief is reasoning on top of those results, and it is labeled as such.
	</p>
</section>

<ExampleBriefs briefs={data.examples} />

<section class="mt-12">
	<h2 class="text-lg font-semibold">Featured markets</h2>
	<ul class="mt-4 grid gap-4 md:grid-cols-3">
		{#each FEATURED_MARKETS as m (m.id)}
			<li>
				<div
					class="flex h-full flex-col rounded-xl bg-white ring-1 ring-zinc-200 transition focus-within:ring-indigo-400 hover:ring-indigo-400"
				>
					<a href="{resolve('/new')}?market={m.id}" class="flex flex-1 flex-col p-5 pb-3">
						<span class="font-semibold text-zinc-900">{m.name}</span>
						<span class="text-sm text-zinc-500">{m.countryName}</span>
						{#if m.note}<span class="mt-2 text-sm text-zinc-600">{m.note}</span>{/if}
						<span class="mt-auto flex flex-wrap gap-1.5 pt-4">
							{#each m.sampleArtists as a (a)}
								<span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{a}</span>
							{/each}
						</span>
					</a>
					<a
						href={resolve('/market/[slug]', { slug: m.id })}
						class="px-5 pb-4 text-xs font-medium text-indigo-600 hover:underline"
						>Market dashboard</a
					>
				</div>
			</li>
		{/each}
	</ul>
</section>

<section class="mt-12">
	<h2 class="text-lg font-semibold">How it works</h2>
	<ol class="mt-4 grid gap-4 md:grid-cols-3">
		{#each steps as s, i (s)}
			<li class="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
				<span
					class="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white"
					>{i + 1}</span
				>
				<span class="text-zinc-700">{s}</span>
			</li>
		{/each}
	</ol>
</section>

<section class="mt-12">
	<h2 class="mb-4 text-lg font-semibold">Recent briefs</h2>
	<RecentBriefs briefs={data.recent} />
</section>
