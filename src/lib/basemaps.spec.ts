import { describe, expect, it } from 'vitest';
import {
	MAPTILER_OUTDOOR_STYLE_URL,
	OSM_RASTER_TILES,
	maptilerOutdoorStyleUrl,
	rasterXyzStyle,
	resolveBasemapStyle
} from './basemaps';

describe('maptilerOutdoorStyleUrl', () => {
	it('builds the outdoor-v4 style URL with an encoded key', () => {
		expect(maptilerOutdoorStyleUrl('abc/def')).toBe(
			`${MAPTILER_OUTDOOR_STYLE_URL}?key=${encodeURIComponent('abc/def')}`
		);
	});
});

describe('rasterXyzStyle', () => {
	it('builds a MapLibre raster style from a tile URL template', () => {
		const style = rasterXyzStyle('https://example.test/{z}/{x}/{y}.png');
		expect(style.version).toBe(8);
		expect(style.sources).toEqual({
			osm: {
				type: 'raster',
				tiles: ['https://example.test/{z}/{x}/{y}.png'],
				tileSize: 256,
				attribution: '© OpenStreetMap'
			}
		});
		expect(style.layers).toEqual([{ id: 'osm', type: 'raster', source: 'osm' }]);
	});
});

describe('resolveBasemapStyle', () => {
	it('prefers PUBLIC_MAP_TILES as a raster XYZ style', () => {
		const style = resolveBasemapStyle({
			PUBLIC_MAP_TILES: 'https://tiles.example/{z}/{x}/{y}.png',
			PUBLIC_MAPTILER_API_KEY: 'should-not-win'
		});
		expect(typeof style).toBe('object');
		if (typeof style === 'string') throw new Error('expected raster object');
		expect(style.sources?.osm).toMatchObject({
			type: 'raster',
			tiles: ['https://tiles.example/{z}/{x}/{y}.png']
		});
	});

	it('uses MapTiler Outdoor vector style URL when only the MapTiler key is set', () => {
		const style = resolveBasemapStyle({
			PUBLIC_MAPTILER_API_KEY: 'test-key'
		});
		expect(style).toBe(`${MAPTILER_OUTDOOR_STYLE_URL}?key=test-key`);
		expect(typeof style).toBe('string');
		expect(String(style)).not.toContain('thunderforest');
	});

	it('trims MapTiler key whitespace before building the URL', () => {
		expect(resolveBasemapStyle({ PUBLIC_MAPTILER_API_KEY: '  keyed  ' })).toBe(
			`${MAPTILER_OUTDOOR_STYLE_URL}?key=keyed`
		);
	});

	it('falls back to OSM raster when no tiles URL or MapTiler key', () => {
		const style = resolveBasemapStyle({});
		expect(typeof style).toBe('object');
		if (typeof style === 'string') throw new Error('expected raster object');
		expect(style.sources?.osm).toMatchObject({
			type: 'raster',
			tiles: [OSM_RASTER_TILES]
		});
	});

	it('treats empty MapTiler key as unset and uses OSM', () => {
		const style = resolveBasemapStyle({ PUBLIC_MAPTILER_API_KEY: '   ' });
		expect(typeof style).toBe('object');
		if (typeof style === 'string') throw new Error('expected raster object');
		expect(style.sources?.osm).toMatchObject({ tiles: [OSM_RASTER_TILES] });
	});

	it('does not reference Thunderforest in any resolved style', () => {
		const cases = [
			resolveBasemapStyle({}),
			resolveBasemapStyle({ PUBLIC_MAPTILER_API_KEY: 'k' }),
			resolveBasemapStyle({ PUBLIC_MAP_TILES: 'https://x/{z}/{x}/{y}.png' })
		];
		for (const style of cases) {
			expect(JSON.stringify(style).toLowerCase()).not.toContain('thunderforest');
		}
	});
});
