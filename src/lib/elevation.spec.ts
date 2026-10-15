import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geojsonToGpx, parseGpxToLineString, type LineString } from './geo';
import {
	bilinear,
	decodeTerrarium,
	elevationGain,
	fillGaps,
	hasUsableElevation,
	lngLatToPixel,
	parseGpxElevations,
	smoothByDistance
} from './elevation';

const noEle = readFileSync(
	new URL('./__fixtures__/lady-widow-no-ele.gpx', import.meta.url),
	'utf8'
);

describe('GPX elevation detection', () => {
	it('flags a GPX without <ele> as missing', () => {
		const line = parseGpxToLineString(noEle);
		const eles = parseGpxElevations(noEle);
		expect(eles).toHaveLength(line.coordinates.length);
		expect(eles.every((e) => e === null)).toBe(true);
		expect(hasUsableElevation(eles, line.coordinates.length)).toBe(false);
	});

	it('treats all-zero elevation as missing and real values as usable', () => {
		const line: LineString = {
			type: 'LineString',
			coordinates: [
				[146.8, -19.25],
				[146.801, -19.25],
				[146.802, -19.25]
			]
		};
		const zero = geojsonToGpx('z', line, [0, 0, 0]);
		expect(hasUsableElevation(parseGpxElevations(zero), 3)).toBe(false);
		const real = geojsonToGpx('r', line, [10, 20, 15.5]);
		expect(parseGpxElevations(real)).toEqual([10, 20, 15.5]);
		expect(hasUsableElevation(parseGpxElevations(real), 3)).toBe(true);
	});

	it('round-trips self-closing and multi-line trkpts', () => {
		const xml = `<trkseg><trkpt lat="1" lon="2"/><trkpt lat="1" lon="3">
			<ele> 42 </ele><time>x</time></trkpt></trkseg>`;
		expect(parseGpxElevations(xml)).toEqual([null, 42]);
	});
});

describe('terrain sampling maths', () => {
	it('decodes terrarium', () => {
		expect(decodeTerrarium(128, 0, 0)).toBe(0);
		expect(decodeTerrarium(128, 100, 128)).toBe(100.5);
	});

	it('projects to web mercator pixels', () => {
		expect(lngLatToPixel(0, 0, 0, 512)).toEqual({ px: 256, py: 256 });
		const { px } = lngLatToPixel(180, 0, 1, 512);
		expect(px).toBe(1024);
	});

	it('bilinearly interpolates between pixel centres', () => {
		const grid = (x: number, y: number) => x * 10 + y * 100;
		expect(bilinear(0.5, 0.5, grid)).toBe(0);
		expect(bilinear(1, 0.5, grid)).toBe(5);
		expect(bilinear(1, 1, grid)).toBe(55);
	});
});

describe('elevation gain', () => {
	it('fills gaps linearly', () => {
		expect(fillGaps([null, 10, null, 20, null])).toEqual([10, 10, 15, 20, 20]);
	});

	it('smooths out noise so jitter does not inflate gain', () => {
		const n = 200;
		const line: LineString = {
			type: 'LineString',
			coordinates: Array.from({ length: n }, (_, i) => [146.8 + i * 0.0001, -19.25])
		};
		// ~10.5 m spacing, steady 0→100 m climb with ±2 m jitter.
		const eles = Array.from({ length: n }, (_, i) => (i / (n - 1)) * 100 + (i % 2 ? 2 : -2));
		const raw = eles.slice(1).reduce((s, e, i) => s + Math.max(0, e - eles[i]), 0);
		expect(raw).toBeGreaterThan(400);
		const gain = elevationGain(eles, line);
		expect(gain).toBeGreaterThan(85);
		expect(gain).toBeLessThan(105);
	});

	it('averages within the distance window', () => {
		expect(smoothByDistance([0, 10, 20], [0, 1000, 2000], 100)).toEqual([0, 10, 20]);
		expect(smoothByDistance([0, 10, 20], [0, 10, 20], 100)).toEqual([10, 10, 10]);
	});
});
