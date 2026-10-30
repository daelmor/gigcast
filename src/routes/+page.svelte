<script lang="ts">
	import { resolve } from '$app/paths';
	import { FEATURED_MARKETS, REGION_NAMES } from '$lib/markets';
	import { Button, Card, Chip } from '$lib/components/ui';
	import ExampleBriefs from '$lib/components/landing/ExampleBriefs.svelte';
	import HeroTrace from '$lib/components/landing/HeroTrace.svelte';
	import RecentBriefs from '$lib/components/shell/RecentBriefs.svelte';

	let { data } = $props();

	const regions = Object.keys(REGION_NAMES) as (keyof typeof REGION_NAMES)[];
</script>

<svelte:head><title>gigcast · Booking Briefs grounded in cultural data</title></svelte:head>

<!-- The hero is a full-bleed night band in both themes: it breaks out of the main column. -->
<section
	data-theme="dark"
	data-hero
	class="relative -mt-8 ml-[calc(50%-50vw)] w-screen bg-night text-ink sm:-mt-12 print:ml-0 print:w-auto"
>
	<div
		class="mx-auto grid max-w-6xl items-center gap-space-7 px-4 py-space-7 sm:px-6 sm:py-space-8 lg:grid-cols-[1.1fr_1fr]"
	>
		<div>
			<h1 class="max-w-3xl type-heading-1 text-ink sm:type-display lg:type-display-xl">
				Booking Briefs grounded in cultural data
			</h1>
			<p class="mt-space-5 max-w-2xl type-body-lg text-ink-muted">
				A promoter picks an artist, a city and dates. The agent maps the audience, scores demand and
				fit, proposes a lineup, sponsors, venues and ticket tiers, and labels every claim grounded,
				inferred or no coverage.
			</p>
			<Button variant="primary" href={resolve('/new')} class="mt-space-6">Start a brief</Button>
		</div>
		<div class="hidden lg:block">
			<HeroTrace />
		</div>
	</div>
</section>

<section
	class="mt-space-7 rounded-lg border border-line bg-signal-soft p-space-4 text-ink sm:p-space-5"
>
	<h2 class="type-heading-1">Why gigcast</h2>
	<p class="mt-space-3 max-w-3xl type-body">
		gigcast turns an artist, a city and a date window into a Booking Brief a promoter can act on.
		Behind it sits a taste graph of cultural affinities that links artists, brands, places and
		neighbourhoods, so a brief can say where an artist's audience lives, which brands they
		over-index on and which venues sit in the heat, with the data behind every claim. Everything
		else is reasoning on top of those results, and it is labeled as such.
	</p>
</section>

<ExampleBriefs briefs={data.examples} />

<section class="mt-space-7" aria-labelledby="markets-title">
	<h2 id="markets-title" class="type-heading-1">Featured markets</h2>
	{#each regions as region (region)}
		<h3 class="mt-space-5 type-label text-ink-subtle">{REGION_NAMES[region]}</h3>
		<ul class="mt-space-3 grid gap-space-5 md:grid-cols-3">
			{#each FEATURED_MARKETS.filter((m) => m.region === region) as m (m.id)}
				<li class="flex">
					<Card class="flex w-full flex-col" interactive>
						<a
							href="{resolve('/new')}?market={m.id}"
							class="flex flex-1 flex-col rounded-sm text-ink no-underline"
						>
							<span class="type-heading-2">{m.name}</span>
							<span class="type-small text-ink-muted">{m.countryName}</span>
							{#if m.note}<span class="mt-space-2 type-body text-ink-muted">{m.note}</span>{/if}
							<span class="mt-auto flex flex-wrap gap-space-2 pt-space-4">
								{#each m.sampleArtists as a (a)}
									<Chip>{a}</Chip>
								{/each}
							</span>
						</a>
						<a
							href={resolve('/market/[slug]', { slug: m.id })}
							class="mt-space-4 rounded-sm type-small font-semibold text-signal hover:underline"
							>Market dashboard</a
						>
					</Card>
				</li>
			{/each}
		</ul>
	{/each}
</section>

<section class="mt-space-7" aria-labelledby="recent-title">
	<h2 id="recent-title" class="mb-space-4 type-heading-1">Recent briefs</h2>
	<RecentBriefs briefs={data.recent} />
</section>

<style>
	/* The full-bleed hero is 100vw wide; clip the scrollbar gutter so it never causes a horizontal scroll. */
	:global(body:has([data-hero])) {
		overflow-x: clip;
	}
</style>
