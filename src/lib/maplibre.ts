/**
 * MapLibre GL JS v6 under Vite/SvelteKit: call setWorkerUrl with the Vite
 * `?worker&url` import before creating any Map. Without this, GeoJSON sources
 * are processed in a broken/missing worker and overlays silently never paint
 * in production builds (raster tiles still work).
 */
import {
	GeoJSONSource,
	LngLatBounds,
	Map,
	Marker,
	NavigationControl,
	Popup,
	setWorkerUrl
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);

export { GeoJSONSource, LngLatBounds, Map, Marker, NavigationControl, Popup };
