<script lang="ts">
	import Label from '../ui/Label.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import SourceMarks from './SourceMarks.svelte';
	import { num } from './format';
	import type { Brief, PlacePick } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const venues = $derived(brief.draft.venuesAndPartners);

	const KINDS: { kind: PlacePick['kind']; title: string }[] = [
		{ kind: 'venue', title: 'Venues' },
		{ kind: 'pre_party', title: 'Pre-party spots' },
		{ kind: 'hospitality', title: 'Hospitality' },
		{ kind: 'bundle_partner', title: 'Bundle partners' },
		{ kind: 'after_party', title: 'After-party spots' }
	];

	const groups = $derived(
		KINDS.map((k) => ({ ...k, picks: venues.picks.filter((p) => p.kind === k.kind) })).filter(
			(g) => g.picks.length > 0
		)
	);
</script>

<section aria-labelledby="venues">
	<SectionHeader id="venues" title="Venues and partners" note={venues.note} />
	{#if groups.length === 0}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
			No venues or partners in this brief.
		</p>
	{:else}
		<div class="space-y-6">
			{#each groups as group (group.kind)}
				<div>
					<h3 class="text-zinc-500 mb-2 text-sm font-semibold tracking-wide uppercase">
						{group.title}
					</h3>
					<ul class="grid gap-3 md:grid-cols-2">
						{#each group.picks as p (p.entityId)}
							<li class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0">
										<h4 class="text-zinc-900 font-semibold">{p.name}</h4>
										{#if p.address}<p class="text-zinc-500 text-xs">{p.address}</p>{/if}
									</div>
									<div class="text-zinc-600 shrink-0 text-right text-xs">
										{#if p.priceLevel !== undefined}
											<p aria-label="Price level {p.priceLevel} of 4">
												<span class="text-zinc-900 font-semibold">{'$'.repeat(p.priceLevel)}</span
												><span class="text-zinc-300">{'$'.repeat(4 - p.priceLevel)}</span>
											</p>
										{/if}
										{#if p.rating !== undefined}
											<p>{num(p.rating, 1)} / 5</p>
										{/if}
									</div>
								</div>
								<p class="text-zinc-700 mt-2 text-sm leading-relaxed">{p.why}</p>
								<div class="mt-3 flex flex-wrap items-center gap-2">
									<Label label={p.label} />
									<SourceMarks sources={p.sources} />
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</section>
