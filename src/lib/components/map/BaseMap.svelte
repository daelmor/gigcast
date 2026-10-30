<script lang="ts">
	/**
	 * MapLibre wrapper. Loads maplibre-gl on the client only, creates the map and hands it to
	 * the parent through `onready` once the style has loaded, so the parent can add sources and
	 * layers. The basemap follows the theme: a muted light style in Light, a night style in
	 * Dark, both from OpenFreeMap (free vector tiles, no key). After a theme switch the style is
	 * swapped and `onready` fires again, so parents must add their layers idempotently.
	 */
	import { onMount } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// MapLibre resolves its worker as `new URL('./maplibre-gl-worker.mjs', import.meta.url)`,
	// which points at a file the bundler never emits (404 in production, "Worker failed to
	// load"). Import the self-contained worker as an asset and hand MapLibre its real URL.
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
	import { env } from '$env/dynamic/public';
	import { theme, watchTheme } from '$lib/client/theme-colors.svelte';

	export const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
	export const DEFAULT_MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

	interface Props {
		/** [lon, lat] */
		center: [number, number];
		zoom?: number;
		interactive?: boolean;
		class?: string;
		/** Called after the style has loaded, and again after every theme-driven style swap. */
		onready?: (map: MaplibreMap) => void;
		/** Accessible description of what the map shows. */
		label?: string;
	}

	let {
		center,
		zoom = 11,
		interactive = true,
		class: className = '',
		onready,
		label = 'Map'
	}: Props = $props();

	let container: HTMLDivElement;
	let map = $state<MaplibreMap>();
	let failed = $state(false);
	let appliedScheme: 'light' | 'dark' | undefined;

	const styleFor = (scheme: 'light' | 'dark') =>
		scheme === 'dark'
			? env.PUBLIC_MAP_STYLE_URL_DARK || DEFAULT_MAP_STYLE_DARK
			: env.PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE;

	onMount(() => {
		watchTheme();
		let cancelled = false;
		let created: MaplibreMap | undefined;
		(async () => {
			try {
				const maplibre = await import('maplibre-gl');
				if (cancelled) return;
				maplibre.setWorkerUrl(maplibreWorkerUrl);
				appliedScheme = theme.scheme;
				created = new maplibre.Map({
					container,
					style: styleFor(appliedScheme),
					center,
					zoom,
					interactive,
					attributionControl: { compact: true },
					canvasContextAttributes: { preserveDrawingBuffer: true }
				});
				if (interactive) {
					created.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
				}
				created.once('load', () => {
					if (cancelled || !created) return;
					map = created;
					onready?.(created);
				});
				created.on('error', (e) => {
					// Tile errors are noisy and harmless; only a failed style load is fatal.
					if (!map && e?.error && /style/i.test(String(e.error.message ?? ''))) failed = true;
				});
			} catch {
				failed = true;
			}
		})();
		return () => {
			cancelled = true;
			created?.remove();
		};
	});

	$effect(() => {
		const [lon, lat] = center;
		const z = zoom;
		if (map) map.easeTo({ center: [lon, lat], zoom: z, duration: 600 });
	});

	// Swap the basemap when the theme changes; parents re-add their layers in onready.
	$effect(() => {
		const scheme = theme.scheme;
		const m = map;
		if (!m || !appliedScheme || scheme === appliedScheme) return;
		appliedScheme = scheme;
		m.setStyle(styleFor(scheme));
		m.once('style.load', () => onready?.(m));
	});
</script>

<div
	class="relative overflow-hidden rounded-lg bg-surface-sunken {className}"
	role="img"
	aria-label={label}
>
	<!-- Sized with h-full/w-full on purpose: MapLibre's own (unlayered) stylesheet sets
	     position: relative on .maplibregl-map, which beats Tailwind's layered `absolute`. -->
	<div bind:this={container} class="h-full w-full"></div>
	{#if failed}
		<div
			class="absolute inset-0 flex items-center justify-center bg-surface-sunken p-4 text-center type-small text-ink-muted"
		>
			The map tiles could not be loaded. The data below does not depend on them.
		</div>
	{/if}
</div>
