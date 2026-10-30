<script lang="ts">
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();
	const questions = $derived(brief.draft.openQuestions);
</script>

<section aria-labelledby="questions">
	<h2 id="questions" class="mb-4 scroll-mt-24 text-xl font-semibold text-zinc-900">
		Open questions
	</h2>
	{#if questions.length === 0}
		<p class="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
			None. The agent had no unresolved questions for the promoter.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each questions as q, i (i)}
				<li class="flex gap-3 rounded-xl bg-white p-4 text-sm text-zinc-800 ring-1 ring-zinc-200">
					<span class="mt-0.5 font-semibold text-indigo-600" aria-hidden="true">?</span>
					<span>{q}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
