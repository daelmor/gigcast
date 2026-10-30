<script lang="ts">
	import { formatDate } from '../brief/format';
	import Badge from '../ui/Badge.svelte';
	import Card from '../ui/Card.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import type { TravelAdvisory } from '$lib/brief/schema';

	let { advisory }: { advisory: TravelAdvisory } = $props();

	const levelTone = $derived(
		advisory.level !== null && advisory.level >= 4
			? ('critical' as const)
			: advisory.level === 3
				? ('caution' as const)
				: ('neutral' as const)
	);
</script>

<Card as="article">
	<div class="flex flex-wrap items-center gap-space-2">
		<span class="type-label text-ink-subtle">{advisory.source}</span>
		{#if advisory.level !== null}
			<Badge tone={levelTone}>Level {advisory.level} of 4</Badge>
		{/if}
		{#if advisory.publishedAt}<span class="type-small text-ink-subtle"
				>{formatDate(advisory.publishedAt)}</span
			>{/if}
	</div>
	<h3 class="mt-space-2 type-heading-3">
		<ExternalLink href={advisory.url} class="text-ink hover:text-signal"
			>{advisory.title}</ExternalLink
		>
	</h3>
	{#if advisory.summary}<p class="mt-space-1 type-body text-ink-muted">{advisory.summary}</p>{/if}
</Card>
