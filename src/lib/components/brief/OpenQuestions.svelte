<script lang="ts">
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();
	const questions = $derived(brief.draft.openQuestions);
</script>

<section aria-labelledby="questions">
	<h2 id="questions" class="text-zinc-900 mb-4 scroll-mt-24 text-xl font-semibold">
		Open questions
	</h2>
	{#if questions.length === 0}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
			None. The agent had no unresolved questions for the promoter.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each questions as q, i (i)}
				<li class="bg-white text-zinc-800 ring-zinc-200 flex gap-3 rounded-xl p-4 text-sm ring-1">
					<span class="text-indigo-600 mt-0.5 font-semibold" aria-hidden="true">?</span>
					<span>{q}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
