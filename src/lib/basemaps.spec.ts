import { describe, expect, it } from 'vitest';
import {
	BASEMAP_OPTIONS,
	DEFAULT_BASEMAP,
	isBasemapId,
	maptilerSatelliteTileUrl,
	maptilerWanderstoriesStyleUrl,
	osmRasterStyle,
	OUTDOORS_ATTRIBUTION,
	WANDERSTORIES_ATTRIBUTION,
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

	it('builds MapTiler Wanderstories vector style URL including the key', () => {
		const url = maptilerWanderstoriesStyleUrl('test-key');
		expect(url).toBe(
			'https://api.maptiler.com/maps/01a0cba0-48c0-7218-9f6b-cd21102c27a7/style.json?key=test-key'
		);
		expect(url).toContain('key=test-key');
		expect(url).toContain('/maps/01a0cba0-48c0-7218-9f6b-cd21102c27a7/style.json');
		expect(url).not.toContain('thunderforest');
		expect(url).not.toContain('.png');
	});

	it('encodes special characters in the MapTiler API key', () => {
		expect(maptilerWanderstoriesStyleUrl('a+b/c')).toBe(
			'https://api.maptiler.com/maps/01a0cba0-48c0-7218-9f6b-cd21102c27a7/style.json?key=a%2Bb%2Fc'
		);
	});

	it('returns Wanderstories style URL when MapTiler key is set', () => {
		const style = outdoorsStyle('test-key');
		expect(typeof style).toBe('string');
		expect(style).toBe(maptilerWanderstoriesStyleUrl('test-key'));
		expect(styleForBasemap('outdoors', 'test-key')).toBe(style);
	});

	it('falls back to OSM raster StyleSpecification without MapTiler key', () => {
		const style = osmRasterStyle();
		expect(style.version).toBe(8);
		expect(style.sources.outdoors).toMatchObject({
			type: 'raster',
			tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
			tileSize: 256
		});
		expect(style.layers).toEqual([{ id: 'outdoors', type: 'raster', source: 'outdoors' }]);
		expect(OUTDOORS_ATTRIBUTION).toContain('OpenStreetMap');
		expect(outdoorsStyle(null)).toEqual(style);
		expect(outdoorsStyle('')).toEqual(style);
		expect(styleForBasemap('outdoors', null)).toEqual(style);
		expect(styleForBasemap('outdoors', '')).toEqual(style);
	});

	it('builds MapTiler satellite TileJSON URL including the key', () => {
		const url = maptilerSatelliteTileUrl('test-key');
		expect(url).toBe('https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=test-key');
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
		expect(styleForBasemap('satellite', 'test-key')).toEqual(style);
	});

	it('falls back to outdoors when satellite requested without MapTiler key', () => {
		expect(styleForBasemap('satellite', null)).toEqual(osmRasterStyle());
		expect(styleForBasemap('satellite', '')).toEqual(osmRasterStyle());
	});

	it('uses Wanderstories for outdoors and satellite style when MapTiler key is set', () => {
		expect(styleForBasemap('outdoors', 'test-key')).toBe(maptilerWanderstoriesStyleUrl('test-key'));
		expect(styleForBasemap('satellite', 'test-key')).toEqual(satelliteStyle('test-key'));
	});

	it('exports Wanderstories attribution with maps link', () => {
		expect(WANDERSTORIES_ATTRIBUTION).toContain('wanderstories.space/maps');
		expect(WANDERSTORIES_ATTRIBUTION).toContain('Wanderstories');
		expect(WANDERSTORIES_ATTRIBUTION).toContain('rel="noopener"');
	});

	it('narrows basemap ids', () => {
		expect(isBasemapId('outdoors')).toBe(true);
		expect(isBasemapId('satellite')).toBe(true);
		expect(isBasemapId('liberty')).toBe(false);
		expect(isBasemapId('terrain')).toBe(false);
	});
});
