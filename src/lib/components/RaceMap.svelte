<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { GeoJSONSource, LngLatBounds, Map, NavigationControl } from '$lib/maplibre';
	import {
		courseOverlayFeatureCollection,
		isJsonLikeContentType,
		lineFromCoursePayload,
		type CourseFeatureCollection,
		type LineString
	} from '$lib/geo';

	type RaceOverlay = {
		id: string;
		title: string;
		geojson: LineString;
	};

	let {
		races = [],
		focus = null,
		gpxHref = null,
		courseUrl = null
	}: {
		races?: RaceOverlay[];
		focus?: LineString | null;
		gpxHref?: string | null;
		/** When set, fetch course GeoJSON from this URL (primary overlay on race detail). */
		courseUrl?: string | null;
	} = $props();

	let shell = $state<HTMLDivElement | null>(null);
	let isFullscreen = $state(false);
	let mapRef = $state<Map | null>(null);
	let mapReady = $state(false);
	/** LineString extracted from a successful `courseUrl` fetch. */
	let fetchedFocus = $state<LineString | null>(null);

	const SOURCE_ID = 'courses';
	const CASING_LAYER_ID = 'courses-casing';
	const LINE_LAYER_ID = 'courses-line';

	function mapTiles(): string {
		const key = env.PUBLIC_THUNDERFOREST_API_KEY;
		if (key) {
			return `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${key}`;
		}
		return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	}

	function syncFullscreen() {
		isFullscreen = document.fullscreenElement === shell;
	}

	async function toggleFullscreen() {
		if (!shell) return;
		if (document.fullscreenElement === shell) {
			await document.exitFullscreen();
		} else {
			await shell.requestFullscreen();
		}
	}

	function ensureCourseLayers(
		map: Map,
		initialData?: CourseFeatureCollection
	) {
		if (!map.getSource(SOURCE_ID)) {
			map.addSource(SOURCE_ID, {
				type: 'geojson',
				// Seed with known course data when available to avoid empty-then-set race.
				data: initialData ?? { type: 'FeatureCollection', features: [] }
			});
		}
		if (!map.getLayer(CASING_LAYER_ID)) {
			map.addLayer({
				id: CASING_LAYER_ID,
				type: 'line',
				source: SOURCE_ID,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: {
					// Near-white casing so the line reads on green OSM park tiles.
					'line-color': '#fff7ed',
					'line-width': 10,
					'line-opacity': 0.95
				}
			});
		}
		if (!map.getLayer(LINE_LAYER_ID)) {
			map.addLayer({
				id: LINE_LAYER_ID,
				type: 'line',
				source: SOURCE_ID,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: {
					'line-color': '#ea580c',
					'line-width': 5.5
				}
			});
		}
	}

	function drawCourses(map: Map, overlayRaces: RaceOverlay[], focusLine: LineString | null) {
		const collection = courseOverlayFeatureCollection(overlayRaces, focusLine);
		// Belt-and-suspenders: second plain clone before setData (MapLibre + Svelte Proxies).
		const plain = JSON.parse(JSON.stringify(collection)) as CourseFeatureCollection;
		ensureCourseLayers(map, plain);
		const source = map.getSource(SOURCE_ID) as GeoJSONSource;
		source.setData(plain);
		map.triggerRepaint();

		const geos = [...overlayRaces.map((r) => r.geojson), ...(focusLine ? [focusLine] : [])];
		if (geos.length) {
			const b = new LngLatBounds();
			for (const g of geos) {
				for (const [lng, lat] of g.coordinates) b.extend([lng, lat]);
			}
			map.fitBounds(b, { padding: 40, maxZoom: 14 });
		}
	}

	function attachMap(node: HTMLDivElement) {
		const map = new Map({
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
		map.addControl(new NavigationControl(), 'top-right');
		mapRef = map;

		const onFullscreen = () => {
			syncFullscreen();
			map.resize();
		};

		map.once('load', () => {
			mapReady = true;
			// Belt-and-suspenders: paint SSR focus immediately on load.
			drawCourses(map, races, fetchedFocus ?? focus);
		});

		document.addEventListener('fullscreenchange', onFullscreen);

		return () => {
			document.removeEventListener('fullscreenchange', onFullscreen);
			mapReady = false;
			mapRef = null;
			map.remove();
		};
	}

	$effect(() => {
		const url = courseUrl;
		if (!url) {
			fetchedFocus = null;
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(url, { credentials: 'same-origin' });
				if (cancelled) return;
				// Auth HTML / errors must not clear SSR focus: leave fetchedFocus null.
				if (!res.ok) return;
				const contentType = res.headers.get('content-type') ?? '';
				if (!isJsonLikeContentType(contentType)) return;
				const data: unknown = await res.json();
				const line = lineFromCoursePayload(data);
				// Only upgrade when a LineString parses; otherwise keep SSR focus via ??.
				if (!cancelled && line) fetchedFocus = line;
			} catch {
				// Swallow — keep fetchedFocus null so fetchedFocus ?? focus uses SSR data.
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const map = mapRef;
		if (!map || !mapReady) return;
		// SSR focus paints immediately; successful course.json fetch upgrades the overlay.
		drawCourses(map, races, fetchedFocus ?? focus);
	});
</script>

<div
	bind:this={shell}
	class={[
		'group relative h-80 overflow-hidden rounded-xl border border-stone-200 bg-stone-100',
		isFullscreen && 'h-screen w-screen rounded-none border-0'
	]}
>
	<div class="h-full w-full" {@attach attachMap}></div>
	<div class="absolute left-2 top-2 z-10 flex gap-2">
		{#if gpxHref}
			<a
				class="rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-medium text-green-900 shadow-sm ring-1 ring-stone-200 hover:bg-white"
				href={gpxHref}
				data-sveltekit-reload
				data-sveltekit-preload-data="off"
				download>GPX</a
			>
		{/if}
		<button
			type="button"
			class="rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-medium text-green-900 shadow-sm ring-1 ring-stone-200 hover:bg-white"
			onclick={toggleFullscreen}
		>
			{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
		</button>
	</div>
</div>

<style>
	div:fullscreen {
		height: 100%;
		width: 100%;
	}
</style>
