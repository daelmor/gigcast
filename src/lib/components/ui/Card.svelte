<script lang="ts">
	/**
	 * Surface-raised panel with a 1px line border and radius-lg. Padding space-5 on desktop,
	 * space-4 on phones. Interactive cards (href or `interactive`) turn the border signal on
	 * hover; no lift, no shadow.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		href?: string;
		interactive?: boolean;
		/** Set false for cards that lay out their own padding (maps, tables). */
		padded?: boolean;
		as?: 'div' | 'article' | 'section' | 'li';
		class?: string;
		children: Snippet;
	}
	let {
		href,
		interactive = false,
		padded = true,
		as = 'div',
		class: className = '',
		children
	}: Props = $props();

	const classes = $derived(
		`block min-w-0 rounded-lg border border-line bg-surface-raised text-ink ${padded ? 'p-space-4 sm:p-space-5' : ''} ${
			href || interactive ? 'transition-colors duration-[120ms] hover:border-signal' : ''
		} ${className}`
	);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved urls -->
	<a {href} class="{classes} no-underline">
		{@render children()}
	</a>
{:else}
	<svelte:element this={as} class={classes}>
		{@render children()}
	</svelte:element>
{/if}
