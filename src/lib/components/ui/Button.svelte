<script lang="ts">
	/**
	 * One primary button per view, for the thing the page exists to do. Secondary for the rest,
	 * ghost for toolbar actions inside a document. Renders an <a> when given `href`.
	 */
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost';
	type Size = 'md' | 'sm';

	interface Props {
		variant?: Variant;
		size?: Size;
		href?: string;
		type?: HTMLButtonAttributes['type'];
		disabled?: boolean;
		target?: HTMLAnchorAttributes['target'];
		rel?: HTMLAnchorAttributes['rel'];
		download?: HTMLAnchorAttributes['download'];
		title?: string;
		'aria-label'?: string;
		onclick?: (event: MouseEvent) => void;
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		href,
		type = 'button',
		disabled = false,
		target,
		rel,
		download,
		title,
		'aria-label': ariaLabel,
		onclick,
		class: className = '',
		children
	}: Props = $props();

	const variants: Record<Variant, string> = {
		primary:
			'border-action bg-action text-on-action hover:border-action-hover hover:bg-action-hover',
		secondary: 'border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken',
		ghost: 'border-transparent bg-transparent text-ink-muted hover:bg-signal-soft hover:text-ink'
	};
	const sizes: Record<Size, string> = {
		md: 'h-10 rounded-md px-[18px] type-button',
		sm: 'h-8 rounded-sm px-3 text-[13px] leading-5 font-semibold'
	};
	const classes = $derived(
		`inline-flex items-center justify-center gap-space-2 border whitespace-nowrap no-underline transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`
	);
</script>

{#if href && !disabled}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved or external urls -->
	<a {href} {target} {rel} {download} {title} aria-label={ariaLabel} class={classes} {onclick}>
		{@render children()}
	</a>
{:else}
	<button {type} {disabled} {title} aria-label={ariaLabel} class={classes} {onclick}>
		{@render children()}
	</button>
{/if}
