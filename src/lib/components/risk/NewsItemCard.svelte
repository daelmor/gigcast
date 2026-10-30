<script lang="ts">
	import { formatDate } from '../brief/format';
	import Badge from '../ui/Badge.svelte';
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import CategoryBadge from './CategoryBadge.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import SeverityDots from './SeverityDots.svelte';
	import { TIME_HORIZON_LABELS } from './labels';
	import type { ClassifiedNews } from '$lib/brief/schema';

	let { item }: { item: ClassifiedNews } = $props();
</script>

<Card as="li">
	<div class="flex flex-wrap items-center gap-space-2">
		<CategoryBadge category={item.category} />
		<SeverityDots severity={item.severity} />
		<Chip>{TIME_HORIZON_LABELS[item.timeHorizon]}</Chip>
		{#if item.mentionsSubject}
			<Badge tone="neutral">Mentions the artist or venue</Badge>
		{/if}
	</div>
	<h3 class="mt-space-2 type-heading-3">
		<ExternalLink href={item.url} class="text-ink hover:text-signal">{item.title}</ExternalLink>
	</h3>
	<p class="mt-space-1 type-body text-ink-muted">{item.soWhat}</p>
	<p class="mt-space-2 type-small text-ink-subtle">
		{item.source ?? 'Unknown source'}{item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ''}
	</p>
</Card>
