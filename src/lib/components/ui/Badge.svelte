<script lang="ts">
	/**
	 * Verdict and status pill. `live` is the one place beam appears as a fill in running UI:
	 * use it only while something streams.
	 */
	import type { Snippet } from 'svelte';
	import { TONE_CLASSES, type Tone } from './tones';

	interface Props {
		tone: Tone;
		class?: string;
		children: Snippet;
	}
	let { tone, class: className = '', children }: Props = $props();
</script>

<span
	class="inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[12px] leading-4 font-semibold whitespace-nowrap {TONE_CLASSES[
		tone
	]} {className}"
	data-tone={tone}
>
	{#if tone === 'live'}
		<span class="size-1.5 animate-pulse-live rounded-full bg-on-beam" aria-hidden="true"></span>
	{/if}
	{@render children()}
</span>
