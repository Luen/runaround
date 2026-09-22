/**
 * Basemap style selection for RaceMap / MapLibre.
 * Prefer MapTiler Outdoor vector when a key is set; keep PUBLIC_MAP_TILES as a
 * raster XYZ escape hatch; otherwise OSM raster (no Thunderforest).
 */
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapEnv = {
	PUBLIC_MAP_TILES?: string | undefined;
	PUBLIC_MAPTILER_API_KEY?: string | undefined;
};

/** MapLibre accepts either a style URL string or an inline StyleSpecification. */
export type BasemapStyle = string | StyleSpecification;

export const OSM_RASTER_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAPTILER_OUTDOOR_STYLE_URL =
	'https://api.maptiler.com/maps/outdoor-v4/style.json';

export function maptilerOutdoorStyleUrl(apiKey: string): string {
	return `${MAPTILER_OUTDOOR_STYLE_URL}?key=${encodeURIComponent(apiKey)}`;
}

/** Minimal MapLibre raster XYZ style (same pattern RaceMap used previously). */
export function rasterXyzStyle(
	tilesUrl: string,
	attribution = '© OpenStreetMap'
): StyleSpecification {
	return {
		version: 8,
		sources: {
			osm: {
				type: 'raster',
				tiles: [tilesUrl],
				tileSize: 256,
				attribution
			}
		},
		layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
	};
}

/**
 * Resolve the Outdoors basemap style from public env.
 * Priority: PUBLIC_MAP_TILES (raster) → PUBLIC_MAPTILER_API_KEY (vector URL) → OSM raster.
 */
export function resolveBasemapStyle(env: BasemapEnv): BasemapStyle {
	const tiles = env.PUBLIC_MAP_TILES?.trim();
	if (tiles) return rasterXyzStyle(tiles);

	const key = env.PUBLIC_MAPTILER_API_KEY?.trim();
	if (key) return maptilerOutdoorStyleUrl(key);

	return rasterXyzStyle(OSM_RASTER_TILES);
}
