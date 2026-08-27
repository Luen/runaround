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
		const tiles = mapTiles();
		const map = new maplibregl.Map({
			container: node,
			style: {
				version: 8,
				sources: {
					osm: {
						type: 'raster',
						tiles: [tiles],
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

		const draw = () => {
			const features = races.map((r) => ({
				type: 'Feature' as const,
				properties: { title: r.title, id: r.id },
				geometry: r.geojson
			}));
			if (focus) {
				features.push({
					type: 'Feature',
					properties: { title: 'Course', id: 'focus' },
					geometry: focus
				});
			}
			const sourceId = 'courses';
			const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
			const data = { type: 'FeatureCollection' as const, features };
			if (existing) existing.setData(data);
			else if (map.isStyleLoaded()) {
				map.addSource(sourceId, { type: 'geojson', data });
				map.addLayer({
					id: 'courses-line',
					type: 'line',
					source: sourceId,
					paint: { 'line-color': '#166534', 'line-width': 4 }
				});
			}
			const geos = [...races.map((r) => r.geojson), ...(focus ? [focus] : [])];
			if (geos.length) {
				const b = new maplibregl.LngLatBounds();
				for (const g of geos) {
					for (const [lng, lat] of g.coordinates) b.extend([lng, lat]);
				}
				map.fitBounds(b, { padding: 40, maxZoom: 14 });
			}
		};

		if (map.loaded()) draw();
		else map.once('load', draw);

		return () => map.remove();
	}
</script>

<div class="h-80 overflow-hidden rounded-xl border border-stone-200" {@attach attachMap}></div>
