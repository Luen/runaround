import { describe, expect, it } from 'vitest';
import {
	BASEMAP_OPTIONS,
	DEFAULT_BASEMAP,
	isBasemapId,
	LIBERTY_STYLE_URL,
	OUTDOORS_ATTRIBUTION,
	outdoorsStyle,
	SATELLITE_ATTRIBUTION,
	SATELLITE_TILE_URL,
	satelliteStyle,
	styleForBasemap
} from './basemaps';

describe('basemaps', () => {
	it('defaults to outdoors and lists three options', () => {
		expect(DEFAULT_BASEMAP).toBe('outdoors');
		expect(BASEMAP_OPTIONS.map((o) => o.id)).toEqual(['outdoors', 'liberty', 'satellite']);
	});

	it('builds outdoors raster style from the caller tile URL', () => {
		const style = outdoorsStyle('https://example.test/{z}/{x}/{y}.png');
		expect(style.version).toBe(8);
		expect(style.sources.outdoors).toMatchObject({
			type: 'raster',
			tiles: ['https://example.test/{z}/{x}/{y}.png'],
			tileSize: 256
		});
		expect(style.layers).toEqual([{ id: 'outdoors', type: 'raster', source: 'outdoors' }]);
		expect(OUTDOORS_ATTRIBUTION).toContain('OpenStreetMap');
	});

	it('points Liberty at OpenFreeMap style URL', () => {
		expect(LIBERTY_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/liberty');
		expect(styleForBasemap('liberty', 'unused')).toBe(LIBERTY_STYLE_URL);
	});

	it('builds satellite raster style with EOX tiles and attribution', () => {
		const style = satelliteStyle();
		expect(style.sources.satellite).toMatchObject({
			type: 'raster',
			tiles: [SATELLITE_TILE_URL],
			tileSize: 256,
			maxzoom: 14
		});
		expect(SATELLITE_TILE_URL).toContain('s2cloudless-2020_3857');
		expect(SATELLITE_TILE_URL).toContain('{z}/{y}/{x}');
		expect(SATELLITE_ATTRIBUTION).toContain('EOxCloudless');
		expect(SATELLITE_ATTRIBUTION).toContain('Copernicus Sentinel data 2020');
		expect(styleForBasemap('satellite', 'unused')).toEqual(style);
	});

	it('narrows basemap ids', () => {
		expect(isBasemapId('outdoors')).toBe(true);
		expect(isBasemapId('liberty')).toBe(true);
		expect(isBasemapId('satellite')).toBe(true);
		expect(isBasemapId('terrain')).toBe(false);
	});
});
