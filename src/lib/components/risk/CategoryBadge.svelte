<script lang="ts">
	import { categoryLabel, categoryStyle } from './labels';

	let { category }: { category: string } = $props();
</script>

<span
	class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset {categoryStyle(
		category
	)}">{categoryLabel(category)}</span
>
