<script lang="ts">
	import Card from '../ui/Card.svelte';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();
	const questions = $derived(brief.draft.openQuestions);
</script>

<section aria-labelledby="questions">
	<header class="mb-space-5 border-b border-line pb-space-4">
		<p class="mb-space-1 type-label text-ink-subtle">Section 9 · Questions</p>
		<h2 id="questions" class="scroll-mt-24 type-heading-1 text-ink">Open questions</h2>
	</header>
	{#if questions.length === 0}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			None. The agent had no unresolved questions for the promoter.
		</p>
	{:else}
		<ul class="space-y-space-2">
			{#each questions as q, i (i)}
				<Card as="li" class="flex break-inside-avoid gap-space-3 type-body">
					<span class="font-semibold text-signal" aria-hidden="true">?</span>
					<span>{q}</span>
				</Card>
			{/each}
		</ul>
	{/if}
</section>
