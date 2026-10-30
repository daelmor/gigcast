<script lang="ts">
	/** Mono `[S3]` superscripts in signal, linking to the Sources list. Print as plain text. */
	import { getSourceIndex } from './context';
	import type { SourceIndex } from './sources';

	interface Props {
		sources: readonly string[] | undefined;
		/** Defaults to the index provided by BriefDocument. */
		index?: SourceIndex;
	}

	let { sources, index }: Props = $props();

	const contextIndex = getSourceIndex();
	const numbers = $derived.by(() => {
		const map = (index ?? contextIndex)?.indexByCallId;
		if (!map || !sources) return [];
		const found = sources.flatMap((id) => {
			const n = map.get(id);
			return n === undefined ? [] : [n];
		});
		return found.filter((n, i) => found.indexOf(n) === i).sort((a, b) => a - b);
	});
</script>

{#if numbers.length > 0}
	<span class="inline-flex flex-wrap gap-x-0.5 align-baseline">
		{#each numbers as n (n)}
			<a
				href="#source-{n}"
				class="ml-0.5 align-super type-data-sm leading-none text-signal no-underline hover:underline"
				aria-label="Source {n}">[S{n}]</a
			>
		{/each}
	</span>
{/if}
