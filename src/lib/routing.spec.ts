import { describe, expect, it } from 'vitest';
import {
	buildRouteRequest,
	joinLegs,
	legCoordinates,
	lineDistanceM,
	parseDrawnCourse,
	parseRouteResponse,
	routingConfigFromEnv,
	type Coord
} from './routing';
import { geojsonToGpx, parseGpxToLineString } from './geo';

const a: Coord = [146.75, -19.3];
const b: Coord = [146.76, -19.31];

describe('routingConfigFromEnv', () => {
	it('is null when unset or missing a key', () => {
		expect(routingConfigFromEnv({})).toBeNull();
		expect(routingConfigFromEnv({ ROUTING_PROVIDER: 'ors' })).toBeNull();
		expect(routingConfigFromEnv({ ROUTING_PROVIDER: 'osrm' })).toBeNull();
	});
	it('defaults ORS to the foot-hiking profile', () => {
		expect(routingConfigFromEnv({ ROUTING_PROVIDER: 'ors', ROUTING_API_KEY: 'k' })).toEqual({
			provider: 'ors',
			apiKey: 'k',
			baseUrl: 'https://api.openrouteservice.org',
			profile: 'foot-hiking'
		});
	});
	it('accepts a keyless self-hosted OSRM', () => {
		expect(
			routingConfigFromEnv({ ROUTING_PROVIDER: 'osrm', ROUTING_BASE_URL: 'http://osrm:5000/' })
		).toMatchObject({ provider: 'osrm', baseUrl: 'http://osrm:5000', profile: 'foot' });
	});
});

describe('buildRouteRequest / parseRouteResponse', () => {
	it('ORS posts lng,lat and reads GeoJSON', () => {
		const cfg = routingConfigFromEnv({ ROUTING_PROVIDER: 'ors', ROUTING_API_KEY: 'k' })!;
		const req = buildRouteRequest(cfg, a, b);
		expect(req.url).toBe('https://api.openrouteservice.org/v2/directions/foot-hiking/geojson');
		expect(JSON.parse(String(req.init.body)).coordinates).toEqual([a, b]);
		expect(
			parseRouteResponse('ors', { features: [{ geometry: { coordinates: [a, b] } }] })
		).toEqual([a, b]);
	});
	it('GraphHopper uses lat,lng points and unencoded geometry', () => {
		const cfg = routingConfigFromEnv({ ROUTING_PROVIDER: 'graphhopper', ROUTING_API_KEY: 'k' })!;
		const url = new URL(buildRouteRequest(cfg, a, b).url);
		expect(url.searchParams.getAll('point')).toEqual(['-19.3,146.75', '-19.31,146.76']);
		expect(url.searchParams.get('points_encoded')).toBe('false');
		expect(
			parseRouteResponse('graphhopper', { paths: [{ points: { coordinates: [a, b] } }] })
		).toEqual([a, b]);
	});
	it('OSRM puts coordinates in the path', () => {
		const cfg = routingConfigFromEnv({ ROUTING_PROVIDER: 'osrm', ROUTING_BASE_URL: 'http://o' })!;
		expect(buildRouteRequest(cfg, a, b).url).toBe(
			'http://o/route/v1/foot/146.75,-19.3;146.76,-19.31?overview=full&geometries=geojson'
		);
		expect(parseRouteResponse('osrm', { routes: [{ geometry: { coordinates: [a, b] } }] })).toEqual(
			[a, b]
		);
	});
	it('returns null for error bodies', () => {
		expect(parseRouteResponse('ors', { error: 'x' })).toBeNull();
		expect(parseRouteResponse('osrm', null)).toBeNull();
	});
});

describe('legs', () => {
	it('pins routed legs to the clicked waypoints and falls back to straight lines', () => {
		const mid: Coord = [146.755, -19.305];
		expect(legCoordinates(a, b, [[146.7501, -19.3001], mid, [146.7599, -19.3099]])).toEqual([
			a,
			mid,
			b
		]);
		expect(legCoordinates(a, b, null)).toEqual([a, b]);
	});
	it('joins legs without duplicate joints', () => {
		const c: Coord = [146.77, -19.3];
		expect(
			joinLegs([
				[a, b],
				[b, c]
			])
		).toEqual([a, b, c]);
	});
	it('merges joints that only differ beyond 6 decimal places', () => {
		const c: Coord = [146.77, -19.3];
		const bb: Coord = [146.7600000001, -19.31];
		expect(
			joinLegs([
				[a, bb],
				[bb, c]
			])
		).toEqual([a, b, c]);
	});
	it('measures distance', () => {
		expect(lineDistanceM([a, b])).toBeGreaterThan(1400);
		expect(lineDistanceM([a, b])).toBeLessThan(1600);
	});
});

describe('parseDrawnCourse', () => {
	it('accepts a LineString and round-trips through the GPX format uploads use', () => {
		const course = parseDrawnCourse(JSON.stringify({ type: 'LineString', coordinates: [a, b] }));
		expect(course).not.toBeNull();
		const gpx = geojsonToGpx('Drawn', course!);
		expect(parseGpxToLineString(gpx).coordinates).toEqual([a, b]);
	});
	it('rejects junk, out-of-range and tiny courses', () => {
		expect(parseDrawnCourse('')).toBeNull();
		expect(parseDrawnCourse('{nope')).toBeNull();
		expect(parseDrawnCourse({ type: 'Point', coordinates: a })).toBeNull();
		expect(parseDrawnCourse({ type: 'LineString', coordinates: [a, [200, 0]] })).toBeNull();
		expect(
			parseDrawnCourse({ type: 'LineString', coordinates: [a, [146.7501, -19.3]] })
		).toBeNull();
	});
});
