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
	import type { Map as MaplibreMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
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

	async function onready(m: MaplibreMap) {
		const maplibre = await import('maplibre-gl');

		m.addSource('cells', { type: 'geojson', data: cellsGeoJSON(dimension) });
		m.addLayer({
			id: 'cells-heat',
			type: 'heatmap',
			source: 'cells',
			maxzoom: 14,
			paint: {
				'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 1],
				'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 14, 2],
				'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 8, 14, 11, 38, 14, 90],
				'heatmap-color': [
					'interpolate',
					['linear'],
					['heatmap-density'],
					0,
					'rgba(99,102,241,0)',
					0.2,
					'rgba(199,210,254,0.55)',
					0.4,
					'rgba(129,140,248,0.7)',
					0.6,
					'rgba(99,102,241,0.8)',
					0.8,
					'rgba(67,56,202,0.88)',
					1,
					'rgba(49,46,129,0.95)'
				],
				'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.9, 14, 0]
			}
		});
		m.addLayer({
			id: 'cells-circle',
			type: 'circle',
			source: 'cells',
			minzoom: 12,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 14],
				'circle-color': [
					'case',
					['get', 'has'],
					['interpolate', ['linear'], ['get', 'w'], 0, '#c7d2fe', 0.5, '#6366f1', 1, '#312e81'],
					'#d4d4d8'
				],
				'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 0.85],
				'circle-stroke-width': 1,
				'circle-stroke-color': '#ffffff'
			}
		});

		const overlays: Array<[string, MapPoint[], string]> = [
			['hotspots', hotspots, '#f59e0b'],
			['venues', venues, '#7c3aed']
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
					'circle-stroke-color': '#ffffff'
				}
			});
			m.on('click', `${id}-circle`, (e: MapMouseEvent) => {
				const f = m.queryRenderedFeatures(e.point, { layers: [`${id}-circle`] })[0];
				if (!f) return;
				const box = document.createElement('div');
				box.style.maxWidth = '220px';
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

		if (cells.length > 0) {
			const bounds = new maplibre.LngLatBounds();
			for (const c of cells) bounds.extend([c.lon, c.lat]);
			m.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 0 });
		}
		map = m;
	}

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
		class="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-white/90 px-2.5 py-2 text-xs text-zinc-700 shadow-sm ring-1 ring-zinc-200"
	>
		<p class="font-medium">{DIMENSION_LABEL[dimension]}</p>
		<div
			class="mt-1 h-1.5 w-24 rounded-full"
			style="background: linear-gradient(to right, #c7d2fe, #6366f1, #312e81)"
		></div>
		<div class="flex justify-between text-[10px] text-zinc-500">
			<span>low</span><span>high</span>
		</div>
		<p class="mt-1.5 flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-amber-500 ring-2 ring-white"></span>Hotspot
		</p>
		<p class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-violet-600 ring-2 ring-white"></span>Venue or partner
		</p>
	</div>
</div>
