import { describe, expect, it } from 'vitest';
import { geojsonToGpx, type LineString } from './geo';
import { needsElevationBackfill, withTimeout } from './elevation-backfill-policy';

const line = {
	coordinates: [
		[146.8, -19.26],
		[146.81, -19.27]
	]
};

describe('needsElevationBackfill', () => {
	it('is true for a course stored with 0 m gain (Lady Widow regression)', () => {
		expect(needsElevationBackfill({ elevationGainM: 0, courseGeojson: line })).toBe(true);
	});
	it('is false once gain is stored', () => {
		expect(needsElevationBackfill({ elevationGainM: 178, courseGeojson: line })).toBe(false);
	});
	it('is false without a usable course', () => {
		expect(needsElevationBackfill({ elevationGainM: 0, courseGeojson: { coordinates: [] } })).toBe(
			false
		);
	});
	it('is false once the stored GPX carries usable elevation, even at 0 m gain (#236)', () => {
		const stored: LineString = {
			type: 'LineString',
			coordinates: line.coordinates as [number, number][]
		};
		const gpx = geojsonToGpx('flat', stored, [10, 12]);
		expect(needsElevationBackfill({ elevationGainM: 0, courseGeojson: line, gpx })).toBe(false);
	});
});

describe('withTimeout', () => {
	it('resolves fast work', async () => {
		await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
	});
	it('rejects slow work', async () => {
		await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow(/Timed out/);
	});
});
