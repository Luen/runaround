import { describe, expect, it } from 'vitest';
import {
	decodePolyline,
	parseClockToMs,
	parseDmy,
	formatDuration,
	parseGpxToLineString,
	courseOverlayFeatureCollection,
	colorForRaceId,
	raceCourseJsonUrl,
	isJsonLikeContentType,
	lineFromCoursePayload,
	lineStringLengthMeters
} from '$lib/geo';
import {
	courseCoverage,
	matchActivityToCourse,
	rankImproved,
	inRaceWindow,
	computeRaceStatus,
	effectiveRaceStatus,
	timedPointsFromStreams,
	ROAD_BUFFER_M
} from '$lib/matching';

describe('polyline and time helpers', () => {
	it('decodes a short polyline', () => {
		const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
		expect(pts.length).toBeGreaterThan(1);
		expect(pts[0].lat).toBeCloseTo(38.5, 1);
	});

	it('parses race clock strings', () => {
		expect(parseClockToMs('14:06')).toBe((14 * 60 + 6) * 1000);
		expect(parseClockToMs('1:02:32')).toBe((1 * 3600 + 2 * 60 + 32) * 1000);
		expect(formatDuration(14 * 60 * 1000 + 6 * 1000)).toBe('14:06');
	});

	it('parses D/M/YY windows', () => {
		const d = parseDmy('1/10/22');
		expect(d.getUTCFullYear()).toBe(2022);
		expect(d.getUTCMonth()).toBe(9);
		expect(d.getUTCDate()).toBe(1);
	});

	it('parses a minimal GPX track', () => {
		const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
			<trkpt lat="-19.26" lon="146.81"></trkpt>
			<trkpt lat="-19.27" lon="146.82"></trkpt>
		</trkseg></trk></gpx>`;
		const line = parseGpxToLineString(gpx);
		expect(line.coordinates).toHaveLength(2);
		expect(line.coordinates[0][0]).toBe(146.81);
	});
});

describe('course matching', () => {
	const course = [
		{ lng: 146.81, lat: -19.26 },
		{ lng: 146.811, lat: -19.261 },
		{ lng: 146.812, lat: -19.262 }
	];

	it('requires coverage of the course', () => {
		const activity = course.map((p) => ({ ...p }));
		expect(courseCoverage(course, activity, ROAD_BUFFER_M)).toBe(1);
		expect(courseCoverage(course, [{ lng: 0, lat: 0 }], ROAD_BUFFER_M)).toBe(0);
	});

	it('computes time on course when the GPS follows the route', () => {
		const match = matchActivityToCourse({
			course,
			activity: course.map((point, i) => ({ point, t: i * 10 })),
			surface: 'road'
		});
		expect(match.ok).toBe(true);
		if (match.ok) expect(match.timeMs).toBe(20_000);
	});

	it('rejects a trace that misses the course', () => {
		const match = matchActivityToCourse({
			course,
			activity: [
				{ point: { lng: 0, lat: 0 }, t: 0 },
				{ point: { lng: 0.01, lat: 0.01 }, t: 30 }
			],
			surface: 'road'
		});
		expect(match.ok).toBe(false);
	});
});

describe('leaderboard rules', () => {
	it('treats a lower place number as an improvement, not a first appearance', () => {
		expect(rankImproved(5, 3)).toBe(true);
		expect(rankImproved(2, 4)).toBe(false);
		expect(rankImproved(null, 8)).toBe(false);
	});

	it('counts race-board times only inside the window', () => {
		const start = new Date('2022-01-01T00:00:00Z');
		const end = new Date('2022-01-31T23:59:59Z');
		expect(inRaceWindow(new Date('2022-01-15T00:00:00Z'), start, end)).toBe(true);
		expect(inRaceWindow(new Date('2022-03-01T00:00:00Z'), start, end)).toBe(false);
	});

	it('derives upcoming / live / closed from the window', () => {
		const start = new Date('2022-01-10T00:00:00Z');
		const end = new Date('2022-01-20T00:00:00Z');
		expect(computeRaceStatus(start, end, new Date('2022-01-01T00:00:00Z'))).toBe('upcoming');
		expect(computeRaceStatus(start, end, new Date('2022-01-15T00:00:00Z'))).toBe('live');
		expect(computeRaceStatus(start, end, new Date('2022-02-01T00:00:00Z'))).toBe('closed');
	});

	it('derives displayed status from the clock but keeps drafts', () => {
		const race = {
			status: 'upcoming',
			startsAt: new Date('2022-01-10T00:00:00Z'),
			endsAt: new Date('2022-01-20T00:00:00Z')
		};
		expect(effectiveRaceStatus(race, new Date('2022-01-15T00:00:00Z'))).toBe('live');
		expect(effectiveRaceStatus(race, new Date('2022-02-01T00:00:00Z'))).toBe('closed');
		expect(
			effectiveRaceStatus({ ...race, status: 'draft' }, new Date('2022-01-15T00:00:00Z'))
		).toBe('draft');
	});
});

describe('timedPointsFromStreams', () => {
	it('requires both latlng and time streams', () => {
		expect(timedPointsFromStreams(undefined, [0, 1])).toEqual({ timed: [], hasTime: false });
		expect(
			timedPointsFromStreams(
				[
					[1, 2],
					[3, 4]
				],
				undefined
			)
		).toEqual({ timed: [], hasTime: false });
		expect(timedPointsFromStreams([[1, 2]], [0])).toEqual({ timed: [], hasTime: false });
	});

	it('pairs points with real timestamps', () => {
		const result = timedPointsFromStreams(
			[
				[1, 2],
				[3, 4]
			],
			[0, 30]
		);
		expect(result.hasTime).toBe(true);
		expect(result.timed).toEqual([
			{ point: { lat: 1, lng: 2 }, t: 0 },
			{ point: { lat: 3, lng: 4 }, t: 30 }
		]);
	});
});

describe('courseOverlayFeatureCollection', () => {
	const line: import('$lib/geo').LineString = {
		type: 'LineString',
		coordinates: [
			[146.81, -19.26],
			[146.82, -19.27]
		]
	};

	it('returns a deep-cloned plain FeatureCollection for MapLibre', () => {
		const proxiedLine = new Proxy(line, {}) as import('$lib/geo').LineString;
		const races = [
			{
				id: 'r1',
				title: 'Demo',
				geojson: proxiedLine,
				href: '/races/r1',
				surface: 'road',
				status: 'live',
				distanceM: 5200
			}
		];
		const fc = courseOverlayFeatureCollection(races, proxiedLine);

		expect(fc.type).toBe('FeatureCollection');
		expect(fc.features).toHaveLength(2);
		expect(fc.features[0].geometry).not.toBe(proxiedLine);
		expect(fc.features[0].geometry).not.toBe(line);
		expect(fc.features[0].geometry.coordinates).toEqual(line.coordinates);
		expect(fc.features[0].properties.href).toBe('/races/r1');
		expect(fc.features[0].properties.surface).toBe('road');
		expect(fc.features[0].properties.distanceM).toBe(5200);
		expect(fc.features[0].properties.color).toBe(colorForRaceId('r1'));
		expect(fc.features[1].properties.id).toBe('focus');
		expect(fc.features[1].properties.color).toBe('#ea580c');
		// JSON round-trip strips Proxy wrappers
		expect(Object.getPrototypeOf(fc)).toBe(Object.prototype);
		expect(Object.getPrototypeOf(fc.features[0].geometry)).toBe(Object.prototype);
	});

	it('handles empty overlays', () => {
		const fc = courseOverlayFeatureCollection([]);
		expect(fc.features).toEqual([]);
	});
});

describe('raceCourseJsonUrl', () => {
	it('builds the public course.json path for a race slug', () => {
		expect(raceCourseJsonUrl('28927372')).toBe('/races/28927372/course.json');
	});

	it('encodes special characters in the slug', () => {
		expect(raceCourseJsonUrl('a/b')).toBe('/races/a%2Fb/course.json');
	});
});

describe('isJsonLikeContentType', () => {
	it('accepts JSON and GeoJSON content types', () => {
		expect(isJsonLikeContentType('application/json')).toBe(true);
		expect(isJsonLikeContentType('application/geo+json')).toBe(true);
		expect(isJsonLikeContentType('application/json; charset=utf-8')).toBe(true);
	});

	it('rejects HTML login / opaque responses', () => {
		expect(isJsonLikeContentType('text/html')).toBe(false);
		expect(isJsonLikeContentType('text/html; charset=utf-8')).toBe(false);
		expect(isJsonLikeContentType('')).toBe(false);
	});
});

describe('lineFromCoursePayload', () => {
	const line: import('$lib/geo').LineString = {
		type: 'LineString',
		coordinates: [
			[146.81, -19.26],
			[146.82, -19.27]
		]
	};

	it('accepts a bare LineString', () => {
		expect(lineFromCoursePayload(line)).toEqual(line);
	});

	it('unwraps Feature and FeatureCollection', () => {
		expect(lineFromCoursePayload({ type: 'Feature', properties: {}, geometry: line })).toEqual(
			line
		);
		expect(
			lineFromCoursePayload({
				type: 'FeatureCollection',
				features: [{ type: 'Feature', properties: { id: 'x', title: 't' }, geometry: line }]
			})
		).toEqual(line);
	});

	it('returns null for non-course payloads', () => {
		expect(lineFromCoursePayload(null)).toBeNull();
		expect(lineFromCoursePayload({ type: 'Point', coordinates: [1, 2] })).toBeNull();
		expect(lineFromCoursePayload({ type: 'FeatureCollection', features: [] })).toBeNull();
	});
});

describe('colorForRaceId', () => {
	it('returns a stable hsl colour for the same id', () => {
		expect(colorForRaceId('castle-hill')).toBe(colorForRaceId('castle-hill'));
		expect(colorForRaceId('castle-hill')).toMatch(/^hsl\(\d+ 72% 42%\)$/);
	});

	it('varies by id', () => {
		expect(colorForRaceId('a')).not.toBe(colorForRaceId('b'));
	});
});

describe('lineStringLengthMeters', () => {
	it('sums the haversine length along the line', () => {
		const line: import('$lib/geo').LineString = {
			type: 'LineString',
			coordinates: [
				[146.81, -19.26],
				[146.82, -19.26]
			]
		};
		// 0.01° of longitude at this latitude is ~1.05 km.
		expect(lineStringLengthMeters(line)).toBeGreaterThan(1000);
		expect(lineStringLengthMeters(line)).toBeLessThan(1100);
	});

	it('is zero for a degenerate line', () => {
		expect(lineStringLengthMeters({ type: 'LineString', coordinates: [[146.81, -19.26]] })).toBe(0);
	});
});
