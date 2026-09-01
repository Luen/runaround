<script lang="ts">
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { env } from '$env/dynamic/public';
	import type { LineString } from '$lib/geo';

	type RaceOverlay = {
		id: string;
		title: string;
		geojson: LineString;
	};

	let {
		races = [],
		focus = null
	}: {
		races?: RaceOverlay[];
		focus?: LineString | null;
	} = $props();

	function mapTiles(): string {
		if (env.PUBLIC_MAP_TILES) return env.PUBLIC_MAP_TILES;
		const key = env.PUBLIC_THUNDERFOREST_API_KEY;
		if (key) {
			return `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${key}`;
		}
		return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	}

	function attachMap(node: HTMLDivElement) {
		const map = new maplibregl.Map({
			container: node,
			style: {
				version: 8,
				sources: {
					osm: {
						type: 'raster',
						tiles: [mapTiles()],
						tileSize: 256,
						attribution: '© OpenStreetMap'
					}
				},
				layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
			},
			center: [146.81, -19.26],
			zoom: 11
		});
		map.addControl(new maplibregl.NavigationControl(), 'top-right');

		const sourceId = 'courses';
		const layerId = 'courses-line';
		let ready = false;

		const ensureSource = () => {
			if (!map.getSource(sourceId)) {
				map.addSource(sourceId, {
					type: 'geojson',
					data: { type: 'FeatureCollection', features: [] }
				});
				map.addLayer({
					id: layerId,
					type: 'line',
					source: sourceId,
					paint: { 'line-color': '#166534', 'line-width': 4 }
				});
			}
		};

		const draw = (overlayRaces: RaceOverlay[], focusLine: LineString | null) => {
			if (!ready) return;
			ensureSource();
			const features = overlayRaces.map((r) => ({
				type: 'Feature' as const,
				properties: { title: r.title, id: r.id },
				geometry: r.geojson
			}));
			if (focusLine) {
				features.push({
					type: 'Feature',
					properties: { title: 'Course', id: 'focus' },
					geometry: focusLine
				});
			}
			const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
			source.setData({ type: 'FeatureCollection', features });
			const geos = [...overlayRaces.map((r) => r.geojson), ...(focusLine ? [focusLine] : [])];
			if (geos.length) {
				const b = new maplibregl.LngLatBounds();
				for (const g of geos) {
					for (const [lng, lat] of g.coordinates) b.extend([lng, lat]);
				}
				map.fitBounds(b, { padding: 40, maxZoom: 14 });
			}
		};

		map.once('load', () => {
			ready = true;
			draw(races, focus);
		});

		$effect(() => {
			draw(races, focus);
		});

		return () => map.remove();
	}
</script>

<div class="h-80 overflow-hidden rounded-xl border border-stone-200" {@attach attachMap}></div>
