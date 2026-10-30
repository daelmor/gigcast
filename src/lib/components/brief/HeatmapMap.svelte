<script lang="ts" module>
	export type Dimension = 'affinity' | 'popularity' | 'quality' | 'priceLevel';

	export interface MapPoint {
		name: string;
		why: string;
		lat: number;
		lon: number;
	}
</script>

<script lang="ts">
	/**
	 * Audience heatmap: Qloo heatmap cells as a weighted MapLibre heatmap layer
	 * that fades into coloured circles at high zoom, plus overlay markers for the
	 * agent's hotspots and venue/partner picks.
	 */
	import BaseMap from '../map/BaseMap.svelte';
	import type {
		ExpressionSpecification,
		Map as MaplibreMap,
		GeoJSONSource,
		MapMouseEvent
	} from 'maplibre-gl';
	import { theme, withAlpha, type ThemeColors } from '$lib/client/theme-colors.svelte';
	import type { HeatmapCellLite } from '$lib/brief/schema';

	interface Props {
		cells: HeatmapCellLite[];
		dimension?: Dimension;
		hotspots?: MapPoint[];
		venues?: MapPoint[];
		/** [lon, lat] used until the cells are fitted, or when there is nothing to fit. */
		center: [number, number];
		class?: string;
	}

	let {
		cells,
		dimension = 'affinity',
		hotspots = [],
		venues = [],
		center,
		class: className = ''
	}: Props = $props();

	let map = $state<MaplibreMap>();

	const DIMENSION_LABEL: Record<Dimension, string> = {
		affinity: 'Affinity',
		popularity: 'Popularity',
		quality: 'Quality',
		priceLevel: 'Price level'
	};

	/** Normalise the chosen dimension to 0..1 so the weights are comparable across dimensions. */
	function cellsGeoJSON(dim: Dimension) {
		const values = cells.map((c) => c[dim]).filter((v): v is number => typeof v === 'number');
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min;
		return {
			type: 'FeatureCollection' as const,
			features: cells.map((c) => {
				const raw = c[dim];
				const has = typeof raw === 'number';
				const w = !has ? 0 : range > 0 ? (raw - min) / range : 0.5;
				return {
					type: 'Feature' as const,
					geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
					properties: {
						geohash: c.geohash,
						affinity: c.affinity,
						popularity: c.popularity ?? null,
						quality: c.quality ?? null,
						priceLevel: c.priceLevel ?? null,
						w,
						has
					}
				};
			})
		};
	}

	function pointsGeoJSON(points: MapPoint[]) {
		return {
			type: 'FeatureCollection' as const,
			features: points.map((p) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
				properties: { name: p.name, why: p.why }
			}))
		};
	}

	/** Heat ramp from the heat tokens: transparent at zero density, heat-5 at the top. */
	const heatRamp = (c: ThemeColors): ExpressionSpecification =>
		[
			'interpolate',
			['linear'],
			['heatmap-density'],
			0,
			withAlpha(c['heat-1'], 0),
			0.2,
			withAlpha(c['heat-1'], 0.6),
			0.4,
			withAlpha(c['heat-2'], 0.75),
			0.6,
			withAlpha(c['heat-3'], 0.85),
			0.8,
			withAlpha(c['heat-4'], 0.9),
			1,
			withAlpha(c['heat-5'], 0.95)
		] as ExpressionSpecification;
	const cellColor = (c: ThemeColors): ExpressionSpecification =>
		[
			'case',
			['get', 'has'],
			['interpolate', ['linear'], ['get', 'w'], 0, c['heat-1'], 0.5, c['heat-3'], 1, c['heat-5']],
			c.line
		] as ExpressionSpecification;

	/** Colours only; called on first load and on every theme change. */
	function applyColors(m: MaplibreMap) {
		const c = theme.colors;
		if (!m.getLayer('cells-heat')) return;
		m.setPaintProperty('cells-heat', 'heatmap-color', heatRamp(c));
		m.setPaintProperty('cells-circle', 'circle-color', cellColor(c));
		m.setPaintProperty('cells-circle', 'circle-stroke-color', c['surface-raised']);
		m.setPaintProperty('hotspots-circle', 'circle-color', c.beam);
		m.setPaintProperty('hotspots-circle', 'circle-stroke-color', c['surface-raised']);
		m.setPaintProperty('venues-circle', 'circle-color', c.signal);
		m.setPaintProperty('venues-circle', 'circle-stroke-color', c['surface-raised']);
	}

	async function onready(m: MaplibreMap) {
		const maplibre = await import('maplibre-gl');
		const c = theme.colors;
		const first = !map;

		// After a theme-driven style swap the sources and layers are gone; add them again.
		if (!m.getSource('cells')) {
			// Dense markets return thousands of geohash cells; scale the intensity down with the
			// count and square the weight so the gradient shows where the strong cells are instead
			// of a single saturated blob.
			const k = Math.min(1, Math.max(0.15, 500 / Math.max(1, cells.length)));
			m.addSource('cells', { type: 'geojson', data: cellsGeoJSON(dimension) });
			m.addLayer({
				id: 'cells-heat',
				type: 'heatmap',
				source: 'cells',
				maxzoom: 14,
				paint: {
					'heatmap-weight': ['^', ['get', 'w'], 2],
					'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.8 * k, 14, 2 * k],
					'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 8, 12, 11, 28, 14, 80],
					'heatmap-color': heatRamp(c),
					'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 14, 0]
				}
			});
			m.addLayer({
				id: 'cells-circle',
				type: 'circle',
				source: 'cells',
				minzoom: 12,
				paint: {
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 14],
					'circle-color': cellColor(c),
					'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 0.85],
					'circle-stroke-width': 1,
					'circle-stroke-color': c['surface-raised']
				}
			});

			const overlays: Array<[string, MapPoint[], string]> = [
				['hotspots', hotspots, c.beam],
				['venues', venues, c.signal]
			];
			for (const [id, points, color] of overlays) {
				m.addSource(id, { type: 'geojson', data: pointsGeoJSON(points) });
				m.addLayer({
					id: `${id}-circle`,
					type: 'circle',
					source: id,
					paint: {
						'circle-radius': 7,
						'circle-color': color,
						'circle-stroke-width': 2,
						'circle-stroke-color': c['surface-raised']
					}
				});
				if (first) {
					m.on('click', `${id}-circle`, (e: MapMouseEvent) => {
						const f = m.queryRenderedFeatures(e.point, { layers: [`${id}-circle`] })[0];
						if (!f) return;
						const box = document.createElement('div');
						box.style.maxWidth = '220px';
						box.style.fontFamily = theme.fonts.sans;
						const title = document.createElement('strong');
						title.textContent = String(f.properties?.name ?? '');
						const why = document.createElement('p');
						why.style.margin = '4px 0 0';
						why.style.fontSize = '12px';
						why.textContent = String(f.properties?.why ?? '');
						box.append(title, why);
						new maplibre.Popup({ offset: 10 }).setLngLat(e.lngLat).setDOMContent(box).addTo(m);
					});
					m.on('mouseenter', `${id}-circle`, () => (m.getCanvas().style.cursor = 'pointer'));
					m.on('mouseleave', `${id}-circle`, () => (m.getCanvas().style.cursor = ''));
				}
			}
		}

		if (first && cells.length > 0) {
			const bounds = new maplibre.LngLatBounds();
			for (const c2 of cells) bounds.extend([c2.lon, c2.lat]);
			m.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 0 });
		}
		map = m;
	}

	$effect(() => {
		void theme.version;
		const m = map;
		if (m) applyColors(m);
	});

	$effect(() => {
		const dim = dimension;
		const m = map;
		if (!m) return;
		(m.getSource('cells') as GeoJSONSource | undefined)?.setData(cellsGeoJSON(dim));
	});
</script>

<div class="relative">
	<BaseMap
		{center}
		zoom={11}
		class="h-80 w-full md:h-[28rem] {className}"
		{onready}
		label="Heatmap of {DIMENSION_LABEL[
			dimension
		].toLowerCase()} for the audience around the artist's city"
	/>
	<div
		class="pointer-events-none absolute bottom-2 left-2 rounded-sm border border-line bg-surface-raised/95 px-2.5 py-2 type-data-sm text-ink-muted"
	>
		<p class="font-medium text-ink">{DIMENSION_LABEL[dimension]}</p>
		<div
			class="mt-1 h-1.5 w-24 rounded-pill"
			style="background: linear-gradient(to right, var(--heat-1), var(--heat-3), var(--heat-5))"
		></div>
		<div class="flex justify-between text-ink-subtle">
			<span>low</span><span>high</span>
		</div>
		<p class="mt-1.5 flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-beam ring-2 ring-surface-raised"></span>Hotspot
		</p>
		<p class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-signal ring-2 ring-surface-raised"></span>Venue or
			partner
		</p>
	</div>
</div>
