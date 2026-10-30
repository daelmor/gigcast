<script lang="ts">
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import type { SectionNote } from '$lib/brief/schema';

	interface Props {
		id: string;
		title: string;
		note: SectionNote;
		/** Eyebrow above the title, for example "Section 1 · Audience". */
		kicker?: string;
	}

	let { id, title, note, kicker }: Props = $props();
</script>

<header class="mb-space-5 border-b border-line pb-space-4">
	{#if kicker}
		<p class="mb-space-1 type-label text-ink-subtle">{kicker}</p>
	{/if}
	<div class="flex flex-wrap items-center gap-x-space-3 gap-y-space-2">
		<h2 {id} class="scroll-mt-24 type-heading-1 text-ink">{title}</h2>
		<EvidenceLabel label={note.label} />
	</div>
	<p class="mt-space-3 max-w-3xl type-body text-ink-muted">{note.summary}</p>
	{#if note.caveats.length > 0}
		<ul class="mt-space-2 max-w-3xl list-disc space-y-0.5 pl-5 type-small text-ink-subtle italic">
			{#each note.caveats as caveat, i (i)}
				<li>{caveat}</li>
			{/each}
		</ul>
	{/if}
</header>
