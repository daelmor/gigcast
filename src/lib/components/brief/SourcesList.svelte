<script lang="ts">
	import { formatDateTime } from './format';
	import { getSourceIndex } from './context';
	import { buildSourceIndex, type SourceIndex } from './sources';
	import type { Brief } from '$lib/brief/schema';

	let { brief, index }: { brief: Brief; index?: SourceIndex } = $props();

	const order = $derived((index ?? getSourceIndex() ?? buildSourceIndex(brief)).order);
</script>

<section aria-labelledby="sources">
	<header class="mb-space-5 border-b border-line pb-space-4">
		<p class="mb-space-1 type-label text-ink-subtle">Section 11 · Sources</p>
		<h2 id="sources" class="scroll-mt-24 type-heading-1 text-ink">Sources</h2>
	</header>
	{#if order.length === 0}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			No Qloo requests were recorded for this brief, so nothing in it is grounded.
		</p>
	{:else}
		<ol class="space-y-space-2">
			{#each order as ref, i (ref.toolCallId)}
				<li
					id="source-{i + 1}"
					class="scroll-mt-24 break-inside-avoid rounded-sm bg-surface-sunken p-space-3 type-data target:ring-2 target:ring-signal"
				>
					<div class="flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
						<span class="font-semibold text-signal">[S{i + 1}]</span>
						<span class="font-semibold text-ink">{ref.tool}</span>
						<span class="text-ink-muted">{ref.endpoint}</span>
						<span class="rounded-pill bg-surface-raised px-2 py-0.5 type-data-sm text-ink-muted"
							>{ref.cacheHit ? 'cache hit' : 'live'}</span
						>
						<span class="text-ink-muted">{formatDateTime(ref.fetchedAt)}</span>
					</div>
					<code class="mt-space-1 block break-all text-ink-muted">{ref.requestKey}</code>
				</li>
			{/each}
		</ol>
	{/if}
</section>
