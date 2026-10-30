<script lang="ts">
	import { formatDateTime } from './format';
	import { getSourceIndex } from './context';
	import { buildSourceIndex, type SourceIndex } from './sources';
	import type { Brief } from '$lib/brief/schema';

	let { brief, index }: { brief: Brief; index?: SourceIndex } = $props();

	const order = $derived((index ?? getSourceIndex() ?? buildSourceIndex(brief)).order);
</script>

<section aria-labelledby="sources">
	<h2 id="sources" class="mb-4 scroll-mt-24 text-xl font-semibold text-zinc-900">Sources</h2>
	{#if order.length === 0}
		<p class="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
			No Qloo requests were recorded for this brief, so nothing in it is grounded.
		</p>
	{:else}
		<ol class="space-y-2">
			{#each order as ref, i (ref.toolCallId)}
				<li
					id="source-{i + 1}"
					class="scroll-mt-24 rounded-xl bg-white p-3 text-sm ring-1 ring-zinc-200 target:ring-2 target:ring-indigo-500"
				>
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span class="font-semibold text-indigo-600">[S{i + 1}]</span>
						<span class="font-medium text-zinc-900">{ref.tool}</span>
						<span class="text-zinc-500">{ref.endpoint}</span>
						<span
							class="rounded-full px-2 py-0.5 text-xs ring-1 ring-inset {ref.cacheHit
								? 'bg-sky-50 text-sky-700 ring-sky-600/20'
								: 'bg-zinc-50 text-zinc-600 ring-zinc-500/20'}"
							>{ref.cacheHit ? 'cache hit' : 'live'}</span
						>
						<span class="text-xs text-zinc-500">{formatDateTime(ref.fetchedAt)}</span>
					</div>
					<code
						class="mt-1.5 block rounded bg-zinc-50 px-2 py-1 font-mono text-xs break-all text-zinc-600"
						>{ref.requestKey}</code
					>
				</li>
			{/each}
		</ol>
	{/if}
</section>
