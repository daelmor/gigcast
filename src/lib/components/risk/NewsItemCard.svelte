<script lang="ts">
	import { formatDate } from '../brief/format';
	import CategoryBadge from './CategoryBadge.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import SeverityDots from './SeverityDots.svelte';
	import { TIME_HORIZON_LABELS } from './labels';
	import type { ClassifiedNews } from '$lib/brief/schema';

	let { item }: { item: ClassifiedNews } = $props();
</script>

<article class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
	<div class="flex flex-wrap items-center gap-2">
		<CategoryBadge category={item.category} />
		<SeverityDots severity={item.severity} />
		<span class="bg-zinc-100 text-zinc-700 rounded-full px-2 py-0.5 text-xs"
			>{TIME_HORIZON_LABELS[item.timeHorizon]}</span
		>
		{#if item.mentionsSubject}
			<span
				class="bg-indigo-50 text-indigo-700 ring-indigo-600/25 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
				>Mentions the artist or venue</span
			>
		{/if}
	</div>
	<h3 class="text-zinc-900 mt-2 font-semibold">
		<ExternalLink href={item.url} class="hover:text-indigo-700 hover:underline"
			>{item.title}</ExternalLink
		>
	</h3>
	<p class="text-zinc-700 mt-1 text-sm">{item.soWhat}</p>
	<p class="text-zinc-500 mt-2 text-xs">
		{item.source ?? 'Unknown source'}{item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ''}
	</p>
</article>
