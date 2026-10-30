<script lang="ts">
	/**
	 * The horizontal lockup, 32px tall by default (the SVG is cropped to the artwork). Two images: the ink version shows in Light, the white
	 * version in Dark (explicit data-theme or the OS preference); never a CSS filter on one file.
	 */
	interface Props {
		height?: number;
		class?: string;
	}
	let { height = 32, class: className = '' }: Props = $props();
</script>

<span class="logo inline-flex items-center {className}" style="--logo-h: {height}px">
	<img
		src="/brand/gigcast-horizontal-ink.svg"
		alt="gigcast"
		class="logo-light block w-auto"
		style="height: var(--logo-h)"
		width="84"
		{height}
		decoding="async"
	/>
	<img
		src="/brand/gigcast-horizontal-white.svg"
		alt="gigcast"
		class="logo-dark block w-auto"
		style="height: var(--logo-h)"
		width="84"
		{height}
		decoding="async"
	/>
</span>

<style>
	.logo-dark {
		display: none;
	}
	:global([data-theme='dark']) .logo-light {
		display: none;
	}
	:global([data-theme='dark']) .logo-dark {
		display: block;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .logo-light {
			display: none;
		}
		:global(:root:not([data-theme='light'])) .logo-dark {
			display: block;
		}
	}
	@media print {
		.logo-dark {
			display: none !important;
		}
		.logo-light {
			display: block !important;
		}
	}
</style>
