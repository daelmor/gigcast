<script lang="ts">
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
	<span class="inline-flex flex-wrap gap-x-1 align-baseline">
		{#each numbers as n (n)}
			<sup class="text-[0.7rem] leading-none font-medium">
				<a
					href="#source-{n}"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					aria-label="Source {n}">[S{n}]</a
				>
			</sup>
		{/each}
	</span>
{/if}
