<script lang="ts">
	/**
	 * Kept for the many call sites that import `Label`: it is the EvidenceLabel. `size="md"`
	 * from the old API maps to the default pill; `size="sm"` to the dense one.
	 */
	import EvidenceLabel from './EvidenceLabel.svelte';
	import type { Label } from '$lib/brief/schema';

	interface Props {
		label: Label;
		size?: 'sm' | 'md';
		bare?: boolean;
		class?: string;
	}
	let { label, size = 'md', bare = false, class: className = '' }: Props = $props();
</script>

<EvidenceLabel {label} {bare} size={size === 'sm' ? 'sm' : 'md'} class={className} />
