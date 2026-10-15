<script lang="ts">
	import { env } from '$env/dynamic/public';
	import type { ResolvedPathname } from '$app/types';
	import {
		BASEMAP_OPTIONS,
		DEFAULT_BASEMAP,
		styleForBasemap,
		WANDERSTORIES_ATTRIBUTION,
		type BasemapId
	} from '$lib/basemaps';
	import { GeoJSONSource, LngLatBounds, Map, NavigationControl, Popup } from '$lib/maplibre';
	import {
		courseOverlayFeatureCollection,
		isJsonLikeContentType,
		lineFromCoursePayload,
		type CourseFeatureCollection,
		type LineString
	} from '$lib/geo';
	import { routeEndpointFeatures } from '$lib/routeMarkers';

	type RaceOverlay = {
		id: string;
		title: string;
		geojson: LineString;
		href?: string | null;
		surface?: string | null;
		status?: string | null;
		distanceM?: number | null;
		color?: string | null;
	};

	let {
		races = [],
		focus = null,
		gpxHref = null,
		courseUrl = null
	}: {
		races?: RaceOverlay[];
		focus?: LineString | null;
		/** Build with resolve() so the link honours the app base path. */
		gpxHref?: ResolvedPathname | null;
		/** When set, fetch course GeoJSON from this URL (primary overlay on race detail). */
		courseUrl?: string | null;
	} = $props();

	let shell = $state<HTMLDivElement | null>(null);
	let isFullscreen = $state(false);
	let mapRef = $state<Map | null>(null);
	let mapReady = $state(false);
	/** LineString extracted from a successful `courseUrl` fetch. */
	let fetchedFocus = $state<LineString | null>(null);
	let basemap = $state<BasemapId>(DEFAULT_BASEMAP);
	/** Bumps when a basemap style finishes loading so overlay $effect can retry. */
	let styleGeneration = $state(0);
	/** Guards stale style.load / idle callbacks across rapid basemap switches. */
	let styleEpoch = 0;
	/** Previous overlay inputs — used so styleGeneration retries do not fitBounds. */
	let prevOverlayRaces: RaceOverlay[] | undefined;
	let prevOverlayFocus: LineString | null | undefined;
	let prevOverlayFetched: LineString | null | undefined;

	const SOURCE_ID = 'courses';
	const CASING_LAYER_ID = 'courses-casing';
	const LINE_LAYER_ID = 'courses-line';
	const HIT_LAYER_ID = 'courses-hit';
	const DEFAULT_LINE_COLOR = '#ea580c';
	const ARROW_LAYER_ID = 'courses-arrows';
	const ENDPOINT_SOURCE_ID = 'course-endpoints';
	const ENDPOINT_LAYER_ID = 'course-endpoints';
	const ARROW_IMAGE = 'route-arrow';
	const ICON_PIXEL_RATIO = 2;

	/** Draw an icon on a canvas so we never depend on basemap sprites/glyphs. */
	function canvasIcon(size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void) {
		const px = size * ICON_PIXEL_RATIO;
		const canvas = document.createElement('canvas');
		canvas.width = px;
		canvas.height = px;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		paint(ctx, px);
		return ctx.getImageData(0, 0, px, px);
	}

	function badgeIcon(fill: string, label: string, fontScale = 0.5) {
		return canvasIcon(26, (ctx, s) => {
			const r = s / 2 - 3;
			ctx.beginPath();
			ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
			ctx.fillStyle = fill;
			ctx.fill();
			ctx.lineWidth = 4;
			ctx.strokeStyle = '#ffffff';
			ctx.stroke();
			ctx.fillStyle = '#ffffff';
			ctx.font = `700 ${Math.round(s * fontScale)}px system-ui, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(label, s / 2, s / 2 + 1);
		});
	}

	function ensureRouteImages(map: Map) {
		const add = (id: string, img: ImageData | null) => {
			if (img && !map.hasImage(id)) map.addImage(id, img, { pixelRatio: ICON_PIXEL_RATIO });
		};
		// Arrow points east (+x); symbol-placement: line rotates it along the course.
		add(
			ARROW_IMAGE,
			canvasIcon(18, (ctx, s) => {
				ctx.beginPath();
				ctx.moveTo(s * 0.2, s * 0.18);
				ctx.lineTo(s * 0.85, s * 0.5);
				ctx.lineTo(s * 0.2, s * 0.82);
				ctx.lineTo(s * 0.38, s * 0.5);
				ctx.closePath();
				ctx.fillStyle = '#ffffff';
				ctx.strokeStyle = '#7c2d12';
				ctx.lineWidth = s * 0.08;
				ctx.lineJoin = 'round';
				ctx.stroke();
				ctx.fill();
			})
		);
		add('route-start', badgeIcon('#15803d', 'S'));
		add('route-finish', badgeIcon('#b91c1c', 'F'));
		add('route-start-finish', badgeIcon('#1d4ed8', 'S/F', 0.32));
	}

	let coursePopup: Popup | null = null;

	function escapeHtml(value: string): string {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;');
	}

	function racePopupHtml(props: Record<string, unknown>): string {
		const title = String(props.title ?? 'Race');
		const href = String(props.href ?? '');
		const surface = String(props.surface ?? '');
		const status = String(props.status ?? '');
		const distanceM = Number(props.distanceM ?? 0);
		const bits = [surface, status].filter(Boolean);
		if (Number.isFinite(distanceM) && distanceM > 0) {
			bits.push(`${(distanceM / 1000).toFixed(1)} km`);
		}
		const meta = bits.length
			? `<p style="margin:0.25rem 0 0;font-size:0.75rem;color:#57534e">${escapeHtml(bits.join(' · '))}</p>`
			: '';
		const link = href
			? `<p style="margin:0.5rem 0 0"><a href="${escapeHtml(href)}" style="color:#166534;font-weight:600">View race →</a></p>`
			: '';
		return `<div style="font:14px/1.4 system-ui,sans-serif"><strong>${escapeHtml(title)}</strong>${meta}${link}</div>`;
	}

	function closeCoursePopup() {
		coursePopup?.remove();
		coursePopup = null;
	}

	function showCoursePopup(
		map: Map,
		lngLat: { lng: number; lat: number },
		props: Record<string, unknown>
	) {
		closeCoursePopup();
		coursePopup = new Popup({
			closeButton: true,
			closeOnClick: true,
			maxWidth: '260px',
			offset: 12
		})
			.setLngLat(lngLat)
			.setHTML(racePopupHtml(props))
			.addTo(map);
	}

	/** Non-empty MapTiler key for Outdoors (Wanderstories) + Satellite; null uses OSM raster and hides Satellite. */
	function maptilerKey(): string | null {
		const key = env.PUBLIC_MAPTILER_API_KEY?.trim();
		return key ? key : null;
	}

	const visibleBasemapOptions = $derived(
		maptilerKey() ? BASEMAP_OPTIONS : BASEMAP_OPTIONS.filter((o) => o.id !== 'satellite')
	);

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

	function ensureCourseLayers(map: Map, initialData?: CourseFeatureCollection) {
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
					// Per-race colour from GeoJSON properties; focus/default stays orange.
					'line-color': ['coalesce', ['get', 'color'], DEFAULT_LINE_COLOR],
					'line-width': 5.5
				}
			});
		}
		ensureRouteImages(map);
		if (!map.getLayer(ARROW_LAYER_ID)) {
			map.addLayer({
				id: ARROW_LAYER_ID,
				type: 'symbol',
				source: SOURCE_ID,
				layout: {
					'symbol-placement': 'line',
					// Screen-pixel spacing: MapLibre repeats arrows per tile, so they thin out zoomed out.
					'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 8, 60, 12, 90, 16, 140],
					'icon-image': ARROW_IMAGE,
					'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 14, 1],
					'icon-rotation-alignment': 'map',
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			});
		}
		if (!map.getSource(ENDPOINT_SOURCE_ID)) {
			map.addSource(ENDPOINT_SOURCE_ID, {
				type: 'geojson',
				data: initialData
					? routeEndpointFeatures(initialData)
					: { type: 'FeatureCollection', features: [] }
			});
		}
		if (!map.getLayer(ENDPOINT_LAYER_ID)) {
			map.addLayer({
				id: ENDPOINT_LAYER_ID,
				type: 'symbol',
				source: ENDPOINT_SOURCE_ID,
				layout: {
					'icon-image': [
						'match',
						['get', 'kind'],
						'start',
						'route-start',
						'finish',
						'route-finish',
						'route-start-finish'
					],
					'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 12, 1],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true,
					'symbol-sort-key': ['match', ['get', 'kind'], 'start', 2, 1]
				}
			});
		}
		// Wider invisible hit target so thin courses are easier to click on the homepage.
		if (!map.getLayer(HIT_LAYER_ID)) {
			map.addLayer({
				id: HIT_LAYER_ID,
				type: 'line',
				source: SOURCE_ID,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: {
					'line-color': '#000000',
					'line-width': 18,
					'line-opacity': 0
				}
			});
		}
	}

	function drawCourses(
		map: Map,
		overlayRaces: RaceOverlay[],
		focusLine: LineString | null,
		options: { fit?: boolean } = {}
	) {
		const { fit = true } = options;
		const collection = courseOverlayFeatureCollection(overlayRaces, focusLine);
		// Belt-and-suspenders: second plain clone before setData (MapLibre + Svelte Proxies).
		const plain = JSON.parse(JSON.stringify(collection)) as CourseFeatureCollection;
		ensureCourseLayers(map, plain);
		const source = map.getSource(SOURCE_ID) as GeoJSONSource;
		source.setData(plain);
		(map.getSource(ENDPOINT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
			routeEndpointFeatures(plain)
		);
		map.triggerRepaint();

		if (!fit) return;
		const geos = [...overlayRaces.map((r) => r.geojson), ...(focusLine ? [focusLine] : [])];
		if (geos.length) {
			const b = new LngLatBounds();
			for (const g of geos) {
				for (const [lng, lat] of g.coordinates) b.extend([lng, lat]);
			}
			map.fitBounds(b, { padding: 40, maxZoom: 14 });
		}
	}

	function currentFocus(): LineString | null {
		return fetchedFocus ?? focus;
	}

	function repaintCourses(map: Map, fit: boolean) {
		drawCourses(map, races, currentFocus(), { fit });
	}

	function applyBasemap(map: Map, id: BasemapId, fitAfter: boolean) {
		const epoch = ++styleEpoch;
		const onStyleReady = () => {
			if (epoch !== styleEpoch || mapRef !== map) return;
			// Notify overlay $effect so it can retry if it early-returned mid-swap.
			styleGeneration += 1;
			// Full style swap drops custom GeoJSON sources/layers — re-add then paint.
			repaintCourses(map, fitAfter);
			// Rare: style.load before sources are queryable — retry once idle.
			if (!map.getSource(SOURCE_ID)) {
				map.once('idle', () => {
					if (epoch !== styleEpoch || mapRef !== map) return;
					repaintCourses(map, fitAfter);
				});
			}
		};
		// Register BEFORE setStyle: MapLibre may fire style.load sync for inline
		// StyleSpecification (OSM/satellite) or async for remote Wanderstories style URLs.
		map.once('style.load', onStyleReady);
		map.setStyle(styleForBasemap(id, maptilerKey()), { diff: false });
	}

	function setBasemap(id: BasemapId) {
		if (id === basemap) return;
		basemap = id;
		const map = mapRef;
		if (!map || !mapReady) return;
		// Keep camera when the user switches basemap.
		applyBasemap(map, id, false);
	}

	function attachMap(node: HTMLDivElement) {
		const map = new Map({
			container: node,
			style: styleForBasemap(DEFAULT_BASEMAP, maptilerKey()),
			center: [146.81, -19.26],
			zoom: 11,
			// One AttributionControl for Outdoors + Satellite; keeps style MapTiler/OSM credits.
			attributionControl: { customAttribution: WANDERSTORIES_ATTRIBUTION }
		});
		map.addControl(new NavigationControl(), 'top-right');
		mapRef = map;
		basemap = DEFAULT_BASEMAP;

		const onFullscreen = () => {
			syncFullscreen();
			map.resize();
		};

		const onCourseClick = (e: {
			lngLat: { lng: number; lat: number };
			features?: Array<{ properties?: Record<string, unknown> | null }>;
		}) => {
			const props = e.features?.[0]?.properties;
			if (!props) return;
			const href = String(props.href ?? '');
			if (!href) return;
			showCoursePopup(map, e.lngLat, props);
		};

		const onCourseEnter = () => {
			map.getCanvas().style.cursor = 'pointer';
		};
		const onCourseLeave = () => {
			map.getCanvas().style.cursor = '';
		};

		map.on('click', HIT_LAYER_ID, onCourseClick);
		map.on('click', LINE_LAYER_ID, onCourseClick);
		map.on('mouseenter', HIT_LAYER_ID, onCourseEnter);
		map.on('mouseleave', HIT_LAYER_ID, onCourseLeave);

		map.once('load', () => {
			mapReady = true;
			// Belt-and-suspenders: paint SSR focus immediately on load.
			repaintCourses(map, true);
		});

		document.addEventListener('fullscreenchange', onFullscreen);

		return () => {
			document.removeEventListener('fullscreenchange', onFullscreen);
			map.off('click', HIT_LAYER_ID, onCourseClick);
			map.off('click', LINE_LAYER_ID, onCourseClick);
			map.off('mouseenter', HIT_LAYER_ID, onCourseEnter);
			map.off('mouseleave', HIT_LAYER_ID, onCourseLeave);
			closeCoursePopup();
			styleEpoch += 1;
			mapReady = false;
			mapRef = null;
			prevOverlayRaces = undefined;
			prevOverlayFocus = undefined;
			prevOverlayFetched = undefined;
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
		// Overlay data deps.
		const r = races;
		const f = focus;
		const ff = fetchedFocus;
		// Re-run after basemap style.load (styleGeneration bump from applyBasemap).
		void styleGeneration;
		// During setStyle, sources are gone until style.load re-adds them.
		if (!map.isStyleLoaded()) return;
		// Fit only when overlay data changed — not on styleGeneration-only retries
		// (basemap switch must keep the camera; applyBasemap already painted with fitAfter).
		const dataChanged =
			r !== prevOverlayRaces || f !== prevOverlayFocus || ff !== prevOverlayFetched;
		prevOverlayRaces = r;
		prevOverlayFocus = f;
		prevOverlayFetched = ff;
		repaintCourses(map, dataChanged);
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
	<div class="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-2">
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
		<div
			role="group"
			aria-label="Basemap"
			class="flex overflow-hidden rounded-md bg-white/95 text-xs font-medium text-green-900 shadow-sm ring-1 ring-stone-200"
		>
			{#each visibleBasemapOptions as opt (opt.id)}
				<button
					type="button"
					aria-pressed={basemap === opt.id}
					class={[
						'px-2.5 py-1.5 hover:bg-white',
						basemap === opt.id ? 'bg-green-800 text-white hover:bg-green-800' : 'bg-transparent'
					]}
					onclick={() => setBasemap(opt.id)}
				>
					{opt.label}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	div:fullscreen {
		height: 100%;
		width: 100%;
	}
</style>
