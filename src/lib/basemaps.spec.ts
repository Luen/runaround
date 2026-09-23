import { describe, expect, it } from 'vitest';
import {
	BASEMAP_OPTIONS,
	DEFAULT_BASEMAP,
	isBasemapId,
	maptilerSatelliteTileUrl,
	osmRasterStyle,
	OUTDOORS_ATTRIBUTION,
	outdoorsStyle,
	SATELLITE_ATTRIBUTION,
	satelliteStyle,
	styleForBasemap,
	thunderforestLandscapeStyleUrl
} from './basemaps';

describe('basemaps', () => {
	it('defaults to outdoors and lists two options', () => {
		expect(DEFAULT_BASEMAP).toBe('outdoors');
		expect(BASEMAP_OPTIONS.map((o) => o.id)).toEqual(['outdoors', 'satellite']);
	});

	it('builds Thunderforest Landscape vector style URL including the key', () => {
		const url = thunderforestLandscapeStyleUrl('test-tf-key');
		expect(url).toBe(
			'https://api.thunderforest.com/styles/landscape/style.json?apikey=test-tf-key'
		);
		expect(url).toContain('apikey=test-tf-key');
		expect(url).toContain('/styles/landscape/style.json');
		expect(url).not.toContain('outdoors');
		expect(url).not.toContain('.png');
	});

	it('encodes special characters in the Thunderforest API key', () => {
		expect(thunderforestLandscapeStyleUrl('a+b/c')).toBe(
			'https://api.thunderforest.com/styles/landscape/style.json?apikey=a%2Bb%2Fc'
		);
	});

	it('returns Landscape style URL when Thunderforest key is set', () => {
		const style = outdoorsStyle('test-tf-key');
		expect(typeof style).toBe('string');
		expect(style).toBe(thunderforestLandscapeStyleUrl('test-tf-key'));
		expect(styleForBasemap('outdoors', 'test-tf-key', null)).toBe(style);
	});

	it('falls back to OSM raster StyleSpecification without Thunderforest key', () => {
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
		expect(styleForBasemap('outdoors', null, null)).toEqual(style);
		expect(styleForBasemap('outdoors', '', 'unused-maptiler')).toEqual(style);
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
		expect(styleForBasemap('satellite', null, 'test-key')).toEqual(style);
		expect(styleForBasemap('satellite', 'tf-key', 'test-key')).toEqual(style);
	});

	it('falls back to outdoors when satellite requested without MapTiler key', () => {
		expect(styleForBasemap('satellite', 'tf-key', null)).toBe(
			thunderforestLandscapeStyleUrl('tf-key')
		);
		expect(styleForBasemap('satellite', null, null)).toEqual(osmRasterStyle());
		expect(styleForBasemap('satellite', null, '')).toEqual(osmRasterStyle());
	});

	it('narrows basemap ids', () => {
		expect(isBasemapId('outdoors')).toBe(true);
		expect(isBasemapId('satellite')).toBe(true);
		expect(isBasemapId('liberty')).toBe(false);
		expect(isBasemapId('terrain')).toBe(false);
	});
});
