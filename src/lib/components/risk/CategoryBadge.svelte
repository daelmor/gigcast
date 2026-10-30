<script lang="ts">
	import Chip from '../ui/Chip.svelte';
	import { categoryLabel } from './labels';

	let { category }: { category: string } = $props();
</script>

<Chip>{categoryLabel(category)}</Chip>
