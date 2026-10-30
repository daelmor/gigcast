<script lang="ts">
	import Label from '$lib/components/ui/Label.svelte';
	import { LABEL_HELP, type Label as LabelKind } from '$lib/brief/schema';

	const labels: LabelKind[] = ['grounded', 'inferred', 'no_coverage'];
</script>

<footer class="mt-16 border-t border-zinc-200 bg-white print:hidden">
	<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
		<ul class="grid gap-3 sm:grid-cols-3" aria-label="Label legend">
			{#each labels as label (label)}
				<li class="flex flex-col items-start gap-1.5">
					<Label {label} />
					<span class="text-sm text-zinc-600">{LABEL_HELP[label]}</span>
				</li>
			{/each}
		</ul>
		<div class="mt-8 flex flex-col gap-1 text-sm text-zinc-500 sm:flex-row sm:justify-between">
			<p>Built for the Qloo Agentic Hackathon</p>
			<p>Taste data: Qloo · Reasoning: Claude on Vertex AI</p>
		</div>
	</div>
</footer>
