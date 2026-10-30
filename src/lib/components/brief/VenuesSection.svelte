<script lang="ts">
	import Card from '../ui/Card.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
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
	<SectionHeader
		id="venues"
		kicker="Section 6 · Venues"
		title="Venues and partners"
		note={venues.note}
	/>
	{#if groups.length === 0}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			No venues or partners in this brief.
		</p>
	{:else}
		<div class="space-y-space-5">
			{#each groups as group (group.kind)}
				<div>
					<h3 class="mb-space-2 type-label text-ink-subtle">{group.title}</h3>
					<ul class="grid gap-space-3 md:grid-cols-2">
						{#each group.picks as p (p.entityId)}
							<Card as="li" class="break-inside-avoid">
								<div class="flex items-start justify-between gap-space-2">
									<div class="min-w-0">
										<h4 class="type-heading-3 text-ink">{p.name}</h4>
										{#if p.address}<p class="type-small text-ink-subtle">{p.address}</p>{/if}
									</div>
									<div class="shrink-0 text-right type-small text-ink-muted tabular-nums">
										{#if p.priceLevel !== undefined}
											<p aria-label="Price level {p.priceLevel} of 4">
												<span class="font-semibold text-ink">{'$'.repeat(p.priceLevel)}</span><span
													class="text-line-strong">{'$'.repeat(4 - p.priceLevel)}</span
												>
											</p>
										{/if}
										{#if p.rating !== undefined}
											<p>{num(p.rating, 1)} / 5</p>
										{/if}
									</div>
								</div>
								<p class="mt-space-2 type-body text-ink-muted">{p.why}</p>
								<div class="mt-space-3 flex flex-wrap items-center gap-space-2">
									<EvidenceLabel label={p.label} />
									<SourceMarks sources={p.sources} />
								</div>
							</Card>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</section>
