<script lang="ts">
	import { formatDate } from '../brief/format';
	import ExternalLink from './ExternalLink.svelte';
	import type { TravelAdvisory } from '$lib/brief/schema';

	let { advisory }: { advisory: TravelAdvisory } = $props();

	const levelStyle = $derived(
		advisory.level === null
			? ''
			: advisory.level >= 4
				? 'bg-rose-50 text-rose-800 ring-rose-600/25'
				: advisory.level === 3
					? 'bg-orange-50 text-orange-800 ring-orange-600/25'
					: advisory.level === 2
						? 'bg-amber-50 text-amber-900 ring-amber-600/25'
						: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25'
	);
</script>

<article class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
	<div class="flex flex-wrap items-center gap-2 text-xs">
		<span class="text-zinc-700 font-semibold">{advisory.source}</span>
		{#if advisory.level !== null}
			<span class="rounded-full px-2 py-0.5 font-medium ring-1 ring-inset {levelStyle}"
				>Level {advisory.level} of 4</span
			>
		{/if}
		{#if advisory.publishedAt}<span class="text-zinc-500">{formatDate(advisory.publishedAt)}</span
			>{/if}
	</div>
	<h3 class="text-zinc-900 mt-2 font-semibold">
		<ExternalLink href={advisory.url} class="hover:text-indigo-700 hover:underline"
			>{advisory.title}</ExternalLink
		>
	</h3>
	{#if advisory.summary}<p class="text-zinc-700 mt-1 text-sm">{advisory.summary}</p>{/if}
</article>
