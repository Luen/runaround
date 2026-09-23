/**
 * Basemap styles for RaceMap. Outdoors via Thunderforest Landscape vector
 * (Vector Styles API) when keyed, else OSM raster; optional MapTiler satellite
 * via PUBLIC_MAPTILER_API_KEY (caller resolves env).
 */
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'outdoors' | 'satellite';

/** MapLibre accepts a remote style URL string or an inline StyleSpecification. */
export type BasemapStyle = string | StyleSpecification;

export const BASEMAP_OPTIONS: { id: BasemapId; label: string }[] = [
	{ id: 'outdoors', label: 'Outdoors' },
	{ id: 'satellite', label: 'Satellite' }
];

export const DEFAULT_BASEMAP: BasemapId = 'outdoors';

export const OUTDOORS_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Fallback attribution when TileJSON is unavailable; MapTiler TileJSON usually supplies its own. */
export const SATELLITE_ATTRIBUTION =
	'© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

const OSM_RASTER_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Thunderforest Landscape vector style URL (Vector Styles API). */
export function thunderforestLandscapeStyleUrl(key: string): string {
	return `https://api.thunderforest.com/styles/landscape/style.json?apikey=${encodeURIComponent(key)}`;
}

/** MapTiler satellite-v2 TileJSON URL (includes API key query param). */
export function maptilerSatelliteTileUrl(key: string): string {
	return `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${encodeURIComponent(key)}`;
}

/** Minimal OSM raster style used when no Thunderforest key is set. */
export function osmRasterStyle(): StyleSpecification {
	return {
		version: 8,
		sources: {
			outdoors: {
				type: 'raster',
				tiles: [OSM_RASTER_TILE_URL],
				tileSize: 256,
				attribution: OUTDOORS_ATTRIBUTION
			}
		},
		layers: [{ id: 'outdoors', type: 'raster', source: 'outdoors' }]
	};
}

/**
 * Outdoors basemap: Thunderforest Landscape vector style URL when keyed,
 * otherwise OSM PNG raster StyleSpecification.
 */
export function outdoorsStyle(thunderforestKey: string | null): BasemapStyle {
	if (thunderforestKey) {
		return thunderforestLandscapeStyleUrl(thunderforestKey);
	}
	return osmRasterStyle();
}

/** Minimal raster style for MapTiler satellite (TileJSON `url` on the source). */
export function satelliteStyle(apiKey: string): StyleSpecification {
	return {
		version: 8,
		sources: {
			satellite: {
				type: 'raster',
				url: maptilerSatelliteTileUrl(apiKey),
				tileSize: 256,
				attribution: SATELLITE_ATTRIBUTION
			}
		},
		layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
	};
}

/**
 * MapLibre `style` / `setStyle` argument for a basemap id.
 * Satellite requires a non-empty MapTiler key; otherwise falls back to outdoors.
 * Outdoors is a remote style URL string when Thunderforest is keyed (async load).
 */
export function styleForBasemap(
	id: BasemapId,
	thunderforestKey: string | null,
	maptilerKey: string | null
): BasemapStyle {
	if (id === 'satellite' && maptilerKey) {
		return satelliteStyle(maptilerKey);
	}
	return outdoorsStyle(thunderforestKey);
}

export function isBasemapId(value: string): value is BasemapId {
	return value === 'outdoors' || value === 'satellite';
}
