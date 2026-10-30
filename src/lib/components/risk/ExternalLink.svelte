<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		href: string;
		class?: string;
		children: Snippet;
	}

	let { href, class: className = '', children }: Props = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	class={className || 'text-signal hover:underline'}>{@render children()}</a
>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
