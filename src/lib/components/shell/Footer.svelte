<script lang="ts">
	import { EvidenceLabel } from '$lib/components/ui';
	import { LABEL_HELP, type Label as LabelKind } from '$lib/brief/schema';

	const labels: LabelKind[] = ['grounded', 'inferred', 'no_coverage'];
</script>

<footer class="mt-space-8 border-t border-line bg-surface print:hidden">
	<div class="mx-auto max-w-6xl px-4 py-space-6 sm:px-6">
		<p class="flex items-center gap-space-2 type-body text-ink">
			<img src="/brand/gigcast-icon-color.svg" alt="" class="h-5 w-auto" />
			Built for the Qloo Agentic Hackathon
		</p>
		<ul class="mt-space-5 grid gap-space-4 sm:grid-cols-3" aria-label="Label legend">
			{#each labels as label (label)}
				<li class="flex flex-col items-start gap-space-2">
					<EvidenceLabel {label} />
					<span class="type-small text-ink-muted">{LABEL_HELP[label]}</span>
				</li>
			{/each}
		</ul>
		<p class="mt-space-6 type-small text-ink-subtle">
			Taste data: Qloo · Reasoning: Claude on Vertex AI
		</p>
	</div>
</footer>
