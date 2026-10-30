<script lang="ts">
	import { formatDate } from '../brief/format';
	import CategoryBadge from './CategoryBadge.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import SeverityDots from './SeverityDots.svelte';
	import { TIME_HORIZON_LABELS } from './labels';
	import type { ClassifiedNews } from '$lib/brief/schema';

	let { item }: { item: ClassifiedNews } = $props();
</script>

<article class="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
	<div class="flex flex-wrap items-center gap-2">
		<CategoryBadge category={item.category} />
		<SeverityDots severity={item.severity} />
		<span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
			>{TIME_HORIZON_LABELS[item.timeHorizon]}</span
		>
		{#if item.mentionsSubject}
			<span
				class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-600/25 ring-inset"
				>Mentions the artist or venue</span
			>
		{/if}
	</div>
	<h3 class="mt-2 font-semibold text-zinc-900">
		<ExternalLink href={item.url} class="hover:text-indigo-700 hover:underline"
			>{item.title}</ExternalLink
		>
	</h3>
	<p class="mt-1 text-sm text-zinc-700">{item.soWhat}</p>
	<p class="mt-2 text-xs text-zinc-500">
		{item.source ?? 'Unknown source'}{item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ''}
	</p>
</article>
