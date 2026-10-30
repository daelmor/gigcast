<script lang="ts">
	import { formatDateTime } from './format';
	import { getSourceIndex } from './context';
	import { buildSourceIndex, type SourceIndex } from './sources';
	import type { Brief } from '$lib/brief/schema';

	let { brief, index }: { brief: Brief; index?: SourceIndex } = $props();

	const order = $derived((index ?? getSourceIndex() ?? buildSourceIndex(brief)).order);
</script>

<section aria-labelledby="sources">
	<h2 id="sources" class="text-zinc-900 mb-4 scroll-mt-24 text-xl font-semibold">Sources</h2>
	{#if order.length === 0}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
			No Qloo requests were recorded for this brief, so nothing in it is grounded.
		</p>
	{:else}
		<ol class="space-y-2">
			{#each order as ref, i (ref.toolCallId)}
				<li
					id="source-{i + 1}"
					class="bg-white ring-zinc-200 target:ring-indigo-500 scroll-mt-24 rounded-xl p-3 text-sm ring-1 target:ring-2"
				>
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span class="text-indigo-600 font-semibold">[S{i + 1}]</span>
						<span class="text-zinc-900 font-medium">{ref.tool}</span>
						<span class="text-zinc-500">{ref.endpoint}</span>
						<span
							class="rounded-full px-2 py-0.5 text-xs ring-1 ring-inset {ref.cacheHit
								? 'bg-sky-50 text-sky-700 ring-sky-600/20'
								: 'bg-zinc-50 text-zinc-600 ring-zinc-500/20'}"
							>{ref.cacheHit ? 'cache hit' : 'live'}</span
						>
						<span class="text-zinc-500 text-xs">{formatDateTime(ref.fetchedAt)}</span>
					</div>
					<code
						class="bg-zinc-50 text-zinc-600 mt-1.5 block rounded px-2 py-1 font-mono text-xs break-all"
						>{ref.requestKey}</code
					>
				</li>
			{/each}
		</ol>
	{/if}
</section>
