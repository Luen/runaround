/**
 * Basemap styles for RaceMap. Outdoors via MapTiler Wanderstories custom
 * vector style when keyed, else OSM raster; optional MapTiler satellite
 * via the same PUBLIC_MAPTILER_API_KEY (caller resolves env).
 */
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'outdoors' | 'satellite';

/** MapLibre accepts a remote style URL string or an inline StyleSpecification. */
export type BasemapStyle = string | StyleSpecification;

export const BASEMAP_OPTIONS: { id: BasemapId; label: string }[] = [
	// Outdoors uses MapTiler Wanderstories custom vector style when keyed.
	{ id: 'outdoors', label: 'Outdoors' },
	{ id: 'satellite', label: 'Satellite' }
];

export const DEFAULT_BASEMAP: BasemapId = 'outdoors';

export const OUTDOORS_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Custom credit for Wanderstories style; combined with MapTiler/OSM from the style via AttributionControl. */
export const WANDERSTORIES_ATTRIBUTION =
	'© <a href="https://wanderstories.space/maps/" target="_blank" rel="noopener">Wanderstories</a>';

/** Fallback attribution when TileJSON is unavailable; MapTiler TileJSON usually supplies its own. */
export const SATELLITE_ATTRIBUTION =
	'© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

const OSM_RASTER_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** MapTiler Wanderstories custom style URL (Outdoors basemap). */
export function maptilerWanderstoriesStyleUrl(key: string): string {
	return `https://api.maptiler.com/maps/01a0cba0-48c0-7218-9f6b-cd21102c27a7/style.json?key=${encodeURIComponent(key)}`;
}

/** MapTiler satellite-v2 TileJSON URL (includes API key query param). */
export function maptilerSatelliteTileUrl(key: string): string {
	return `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${encodeURIComponent(key)}`;
}

/** Minimal OSM raster style used when no MapTiler key is set. */
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
 * Outdoors basemap: MapTiler Wanderstories vector style URL when keyed,
 * otherwise OSM PNG raster StyleSpecification.
 */
export function outdoorsStyle(maptilerKey: string | null): BasemapStyle {
	if (maptilerKey) {
		return maptilerWanderstoriesStyleUrl(maptilerKey);
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
 * Outdoors is a remote style URL string when MapTiler is keyed (async load).
 */
export function styleForBasemap(id: BasemapId, maptilerKey: string | null): BasemapStyle {
	if (id === 'satellite' && maptilerKey) {
		return satelliteStyle(maptilerKey);
	}
	return outdoorsStyle(maptilerKey);
}

export function isBasemapId(value: string): value is BasemapId {
	return value === 'outdoors' || value === 'satellite';
}
