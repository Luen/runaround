import { describe, expect, it } from 'vitest';
import { isLoop, routeEndpointFeatures } from './routeMarkers';
import type { CourseFeatureCollection } from './geo';

function fc(coords: [number, number][], id = 'r1'): CourseFeatureCollection {
	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				properties: {
					title: 'Race',
					id,
					color: '#000',
					href: '',
					surface: '',
					status: '',
					distanceM: 0
				},
				geometry: { type: 'LineString', coordinates: coords }
			}
		]
	};
}

describe('isLoop', () => {
	it('detects start == finish within threshold', () => {
		expect(
			isLoop([
				[153, -27],
				[153.01, -27],
				[153.0001, -27.0001]
			])
		).toBe(true);
	});
	it('rejects point-to-point routes', () => {
		expect(
			isLoop([
				[153, -27],
				[153.05, -27]
			])
		).toBe(false);
	});
	it('needs at least two points', () => {
		expect(isLoop([[153, -27]])).toBe(false);
	});
});

describe('routeEndpointFeatures', () => {
	it('emits start and finish for point-to-point', () => {
		const out = routeEndpointFeatures(
			fc([
				[1, 1],
				[1.5, 1],
				[2, 1]
			])
		);
		const byKind = Object.fromEntries(
			out.features.map((f) => [f.properties.kind, f.geometry.coordinates])
		);
		expect(byKind).toEqual({ start: [1, 1], finish: [2, 1] });
	});
	it('emits one combined marker for loops', () => {
		const out = routeEndpointFeatures(
			fc([
				[1, 1],
				[1.1, 1],
				[1, 1]
			])
		);
		expect(out.features).toHaveLength(1);
		expect(out.features[0].properties.kind).toBe('start-finish');
	});
	it('skips degenerate lines and invalid coords', () => {
		const bad = fc([
			[NaN, 1],
			[2, 2]
		]);
		expect(routeEndpointFeatures(bad).features).toHaveLength(0);
	});
});
