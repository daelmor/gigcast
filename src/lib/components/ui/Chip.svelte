<script lang="ts">
	/**
	 * Quiet token for sample artists, tags and filters. Static when `pressed` is undefined;
	 * a toggle button with aria-pressed otherwise. Chips are neutral on purpose: urgency comes
	 * from SeverityDots and the quiet / watch / loud word, never from a category hue.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		pressed?: boolean;
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		title?: string;
		class?: string;
		children: Snippet;
	}
	let {
		pressed,
		onclick,
		disabled = false,
		title,
		class: className = '',
		children
	}: Props = $props();

	const base =
		'inline-flex h-7 items-center rounded-pill border px-3 text-[13px] leading-5 font-medium whitespace-nowrap transition-colors duration-[120ms]';
</script>

{#if pressed === undefined}
	<span class="{base} border-transparent bg-surface-sunken text-ink-muted {className}" {title}>
		{@render children()}
	</span>
{:else}
	<button
		type="button"
		aria-pressed={pressed}
		{onclick}
		{disabled}
		{title}
		class="{base} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 {pressed
			? 'border-signal bg-signal-soft text-signal'
			: 'border-transparent bg-surface-sunken text-ink-muted hover:text-ink'} {className}"
	>
		{@render children()}
	</button>
{/if}
