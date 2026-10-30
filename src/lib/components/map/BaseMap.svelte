<script lang="ts">
	/**
	 * MapLibre wrapper. Loads maplibre-gl on the client only, creates the map
	 * and hands it to the parent through `onready` once the style has loaded,
	 * so the parent can add sources and layers. Re-centres when `center` or
	 * `zoom` change. The style comes from PUBLIC_MAP_STYLE_URL, OpenFreeMap by
	 * default (free vector tiles, no key).
	 */
	import { onMount } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// MapLibre resolves its worker as `new URL('./maplibre-gl-worker.mjs', import.meta.url)`,
	// which points at a file the bundler never emits (404 in production, "Worker failed to
	// load"). Import the self-contained worker as an asset and hand MapLibre its real URL.
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
	import { env } from '$env/dynamic/public';

	export const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

	interface Props {
		/** [lon, lat] */
		center: [number, number];
		zoom?: number;
		interactive?: boolean;
		class?: string;
		/** Called once, after the style has loaded. */
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

	onMount(() => {
		let cancelled = false;
		let created: MaplibreMap | undefined;
		(async () => {
			try {
				const maplibre = await import('maplibre-gl');
				if (cancelled) return;
				maplibre.setWorkerUrl(maplibreWorkerUrl);
				created = new maplibre.Map({
					container,
					style: env.PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE,
					center,
					zoom,
					interactive,
					// Keeps the canvas readable when the page is printed.
					canvasContextAttributes: { preserveDrawingBuffer: true },
					attributionControl: { compact: true }
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
</script>

<div
	class="bg-zinc-100 relative overflow-hidden rounded-xl {className}"
	role="img"
	aria-label={label}
>
	<!-- Sized with h-full/w-full on purpose: MapLibre's own (unlayered) stylesheet sets
	     position: relative on .maplibregl-map, which beats Tailwind's layered `absolute`. -->
	<div bind:this={container} class="h-full w-full"></div>
	{#if failed}
		<div
			class="bg-zinc-50 text-zinc-500 absolute inset-0 flex items-center justify-center p-4 text-center text-sm"
		>
			The map tiles could not be loaded. The data below does not depend on them.
		</div>
	{/if}
</div>
