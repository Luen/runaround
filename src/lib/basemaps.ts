/**
 * Basemap styles for RaceMap. Free/no-key options only (except optional
 * Thunderforest outdoors via PUBLIC_* env, resolved by the caller).
 */
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'outdoors' | 'liberty' | 'satellite';

export const BASEMAP_OPTIONS: { id: BasemapId; label: string }[] = [
	{ id: 'outdoors', label: 'Outdoors' },
	{ id: 'liberty', label: 'Liberty' },
	{ id: 'satellite', label: 'Satellite' }
];

export const DEFAULT_BASEMAP: BasemapId = 'outdoors';

/** OpenFreeMap Liberty vector style (no API key). Attribution comes from the style. */
export const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * EOX Sentinel-2 cloudless 2020 WMTS (EPSG:3857 Google-compatible matrix).
 * Path order is {z}/{y}/{x} per EOX / MapLibre docs.
 */
export const SATELLITE_TILE_URL =
	'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg';

export const SATELLITE_ATTRIBUTION =
	'<a href="https://cloudless.eox.at/">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)';

export const OUTDOORS_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Minimal raster style used for Outdoors (PUBLIC_MAP_TILES / Thunderforest / OSM). */
export function outdoorsStyle(tileUrl: string): StyleSpecification {
	return {
		version: 8,
		sources: {
			outdoors: {
				type: 'raster',
				tiles: [tileUrl],
				tileSize: 256,
				attribution: OUTDOORS_ATTRIBUTION
			}
		},
		layers: [{ id: 'outdoors', type: 'raster', source: 'outdoors' }]
	};
}

/** Minimal raster-only style for EOX Sentinel-2 cloudless. */
export function satelliteStyle(): StyleSpecification {
	return {
		version: 8,
		sources: {
			satellite: {
				type: 'raster',
				tiles: [SATELLITE_TILE_URL],
				tileSize: 256,
				attribution: SATELLITE_ATTRIBUTION,
				maxzoom: 14
			}
		},
		layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
	};
}

/** MapLibre `setStyle` argument for a basemap id. */
export function styleForBasemap(
	id: BasemapId,
	outdoorsTileUrl: string
): string | StyleSpecification {
	if (id === 'liberty') return LIBERTY_STYLE_URL;
	if (id === 'satellite') return satelliteStyle();
	return outdoorsStyle(outdoorsTileUrl);
}

export function isBasemapId(value: string): value is BasemapId {
	return value === 'outdoors' || value === 'liberty' || value === 'satellite';
}
