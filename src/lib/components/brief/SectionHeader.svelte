<script lang="ts">
	import Label from '../ui/Label.svelte';
	import type { SectionNote } from '$lib/brief/schema';

	interface Props {
		id: string;
		title: string;
		note: SectionNote;
		kicker?: string;
	}

	let { id, title, note, kicker }: Props = $props();
</script>

<header class="mb-5">
	{#if kicker}
		<p class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{kicker}</p>
	{/if}
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
		<h2 {id} class="scroll-mt-24 text-xl font-semibold text-zinc-900">{title}</h2>
		<Label label={note.label} size="md" />
	</div>
	<p class="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-700">{note.summary}</p>
	{#if note.caveats.length > 0}
		<ul class="mt-2 max-w-3xl list-disc space-y-0.5 pl-5 text-xs text-zinc-500 italic">
			{#each note.caveats as caveat (caveat)}
				<li>{caveat}</li>
			{/each}
		</ul>
	{/if}
</header>
