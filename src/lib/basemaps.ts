/**
 * Basemap styles for RaceMap. Outdoors via PUBLIC_MAP_TILES / Thunderforest / OSM;
 * optional MapTiler satellite via PUBLIC_MAPTILER_API_KEY (caller resolves env).
 */
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'outdoors' | 'satellite';

export const BASEMAP_OPTIONS: { id: BasemapId; label: string }[] = [
	{ id: 'outdoors', label: 'Outdoors' },
	{ id: 'satellite', label: 'Satellite' }
];

export const DEFAULT_BASEMAP: BasemapId = 'outdoors';

export const OUTDOORS_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Fallback attribution when TileJSON is unavailable; MapTiler TileJSON usually supplies its own. */
export const SATELLITE_ATTRIBUTION =
	'© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

/** MapTiler satellite-v2 TileJSON URL (includes API key query param). */
export function maptilerSatelliteTileUrl(key: string): string {
	return `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${encodeURIComponent(key)}`;
}

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
 * MapLibre `setStyle` argument for a basemap id.
 * Satellite requires a non-empty MapTiler key; otherwise falls back to outdoors.
 */
export function styleForBasemap(
	id: BasemapId,
	outdoorsTileUrl: string,
	maptilerKey: string | null
): StyleSpecification {
	if (id === 'satellite' && maptilerKey) {
		return satelliteStyle(maptilerKey);
	}
	return outdoorsStyle(outdoorsTileUrl);
}

export function isBasemapId(value: string): value is BasemapId {
	return value === 'outdoors' || value === 'satellite';
}
