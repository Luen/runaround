import { describe, expect, it } from 'vitest';
import {
	BASEMAP_OPTIONS,
	DEFAULT_BASEMAP,
	isBasemapId,
	maptilerSatelliteTileUrl,
	OUTDOORS_ATTRIBUTION,
	outdoorsStyle,
	SATELLITE_ATTRIBUTION,
	satelliteStyle,
	styleForBasemap
} from './basemaps';

describe('basemaps', () => {
	it('defaults to outdoors and lists two options', () => {
		expect(DEFAULT_BASEMAP).toBe('outdoors');
		expect(BASEMAP_OPTIONS.map((o) => o.id)).toEqual(['outdoors', 'satellite']);
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

	it('builds MapTiler satellite TileJSON URL including the key', () => {
		const url = maptilerSatelliteTileUrl('test-key');
		expect(url).toBe(
			'https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=test-key'
		);
		expect(url).toContain('key=test-key');
		expect(url).not.toContain('eox');
	});

	it('builds satellite raster style with MapTiler TileJSON url', () => {
		const style = satelliteStyle('test-key');
		expect(style.sources.satellite).toMatchObject({
			type: 'raster',
			url: maptilerSatelliteTileUrl('test-key'),
			tileSize: 256
		});
		expect(SATELLITE_ATTRIBUTION).toContain('MapTiler');
		expect(styleForBasemap('satellite', 'unused', 'test-key')).toEqual(style);
	});

	it('falls back to outdoors when satellite requested without MapTiler key', () => {
		const outdoors = outdoorsStyle('https://example.test/{z}/{x}/{y}.png');
		expect(styleForBasemap('satellite', 'https://example.test/{z}/{x}/{y}.png', null)).toEqual(
			outdoors
		);
		expect(styleForBasemap('satellite', 'https://example.test/{z}/{x}/{y}.png', '')).toEqual(
			outdoors
		);
	});

	it('narrows basemap ids', () => {
		expect(isBasemapId('outdoors')).toBe(true);
		expect(isBasemapId('satellite')).toBe(true);
		expect(isBasemapId('liberty')).toBe(false);
		expect(isBasemapId('terrain')).toBe(false);
	});
});
