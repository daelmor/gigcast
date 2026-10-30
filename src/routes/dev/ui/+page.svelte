<script lang="ts">
	/** Every design-system component in every state, side by side in Light and Dark. Dev only. */
	import { sampleEvents } from '$lib/brief/fixtures/sample-events';
	import RunTrace from '$lib/components/brief/RunTrace.svelte';
	import SourceMarks from '$lib/components/brief/SourceMarks.svelte';
	import SeverityDots from '$lib/components/risk/SeverityDots.svelte';
	import { Badge, Button, Card, Chip, EvidenceLabel } from '$lib/components/ui';
	import type { Tone } from '$lib/components/ui';

	const tones: Tone[] = ['positive', 'caution', 'critical', 'neutral', 'live'];
	const labels = ['grounded', 'inferred', 'no_coverage'] as const;
	const sourceIndex = {
		order: [],
		indexByCallId: new Map([
			['a', 1],
			['b', 3],
			['c', 12]
		])
	};
	let pressed = $state(true);
	const liveEvents = sampleEvents.slice(0, 7);
</script>

<svelte:head><title>UI kit · gigcast</title></svelte:head>

{#snippet kit(theme: 'light' | 'dark')}
	<div
		data-theme={theme}
		class="flex flex-col gap-space-6 rounded-lg bg-surface p-space-5 text-ink"
	>
		<p class="type-label text-ink-subtle">{theme}</p>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">Button</h2>
			<div class="flex flex-wrap items-center gap-space-3">
				<Button variant="primary">Start a brief</Button>
				<Button>Open the brief</Button>
				<Button variant="ghost">Copy link</Button>
				<Button variant="primary" size="sm">Generate</Button>
				<Button size="sm">Markdown</Button>
				<Button variant="ghost" size="sm">Print</Button>
				<Button variant="primary" disabled>Running…</Button>
				<Button href="/about">As a link</Button>
			</div>
		</section>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">EvidenceLabel</h2>
			<div class="flex flex-wrap items-center gap-space-3">
				{#each labels as label (label)}<EvidenceLabel {label} />{/each}
				{#each labels as label (label)}<EvidenceLabel {label} size="sm" />{/each}
				{#each labels as label (label)}<EvidenceLabel {label} bare />{/each}
			</div>
		</section>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">Badge</h2>
			<div class="flex flex-wrap items-center gap-space-3">
				{#each tones as tone (tone)}<Badge {tone}>{tone === 'live' ? 'Live' : tone}</Badge>{/each}
			</div>
		</section>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">Chip</h2>
			<div class="flex flex-wrap items-center gap-space-2">
				<Chip>Ricardo Arjona</Chip>
				<Chip>Gaby Moreno</Chip>
				<Chip {pressed} onclick={() => (pressed = !pressed)}>Security</Chip>
				<Chip pressed={false}>Transport</Chip>
				<Chip pressed={false} disabled>Disabled</Chip>
			</div>
		</section>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">SeverityDots and SourceMarks</h2>
			<div class="flex flex-wrap items-center gap-space-4">
				{#each [1, 2, 3, 4, 5] as n (n)}<SeverityDots severity={n} />{/each}
				<span class="type-body"
					>Affinity 0.96 <SourceMarks sources={['a', 'b', 'c']} index={sourceIndex} /></span
				>
			</div>
		</section>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">Card</h2>
			<div class="grid gap-space-5 sm:grid-cols-2">
				<Card>
					<div class="flex items-start justify-between gap-space-3">
						<h3 class="type-heading-3">Static card</h3>
						<Badge tone="positive">Promising</Badge>
					</div>
					<p class="mt-1 type-small text-ink-subtle">Guatemala City · Nov 20–22, 2026</p>
					<p class="mt-space-3 type-body text-ink-muted">
						One sentence written by the brief, not marketing copy.
					</p>
				</Card>
				<Card href="/about">
					<h3 class="type-heading-3">Interactive card</h3>
					<p class="mt-1 type-small text-ink-subtle">Hover turns the border signal.</p>
					<p class="mt-space-3 text-[13px] leading-5 font-semibold text-signal">Open the brief</p>
				</Card>
			</div>
		</section>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">Type</h2>
			<p class="type-display-xl">Booking Briefs</p>
			<p class="type-display">Ricardo Arjona · Guatemala City</p>
			<p class="type-heading-1">Audience map</p>
			<p class="type-heading-2">Featured markets</p>
			<p class="type-numeral">1,757</p>
			<p class="type-heading-3">Sponsors this audience over-indexes on</p>
			<p class="type-body-lg">A promoter picks an artist, a city and dates.</p>
			<p class="type-body">One affinity graph links artists, brands, places and neighbourhoods.</p>
			<p class="type-small text-ink-muted">Nov 20–22, 2026 · Guatemala City</p>
			<p class="type-label text-ink-subtle">On this page</p>
			<p class="type-data">urn:entity:artist · filter.location=GT-guatemala</p>
			<p class="type-data-sm text-signal">[S12]</p>
		</section>

		<section class="flex flex-col gap-space-3">
			<h2 class="type-heading-3">TraceLine</h2>
			<RunTrace events={liveEvents} live status="running" />
			<RunTrace events={sampleEvents} status="complete" />
		</section>
	</div>
{/snippet}

<div class="mx-auto max-w-[1400px]">
	<h1 class="mb-space-5 type-heading-1">UI kit</h1>
	<div class="grid gap-space-5 lg:grid-cols-2">
		{@render kit('light')}
		{@render kit('dark')}
	</div>
</div>
