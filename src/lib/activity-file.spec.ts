import { describe, expect, it } from 'vitest';
import { parseGpxActivity, trackFingerprint, UploadError } from './activity-file';

const now = new Date('2027-03-10T00:00:00Z');

function gpx(points: { lat: number; lon: number; time?: string }[], name = 'Morning Run') {
	const pts = points
		.map(
			(p) =>
				`<trkpt lat="${p.lat}" lon="${p.lon}"><ele>10</ele>${p.time ? `<time>${p.time}</time>` : ''}</trkpt>`
		)
		.join('');
	return `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>${name}</name><trkseg>${pts}</trkseg></trk></gpx>`;
}

const run = Array.from({ length: 61 }, (_, i) => ({
	lat: -19.3 + i * 0.0001,
	lon: 146.75,
	time: new Date(Date.parse('2027-03-06T21:00:00Z') + i * 1000).toISOString()
}));

describe('parseGpxActivity', () => {
	it('parses a timed track', () => {
		const a = parseGpxActivity(gpx(run), now);
		expect(a.name).toBe('Morning Run');
		expect(a.startedAt.toISOString()).toBe('2027-03-06T21:00:00.000Z');
		expect(a.elapsedS).toBe(60);
		expect(a.distanceM).toBeGreaterThan(600);
		expect(a.distanceM).toBeLessThan(700);
		// downsampled to every 2 s, last point kept
		expect(a.timed.length).toBe(31);
		expect(a.timed.at(-1)?.t).toBe(60);
	});

	it('rejects a route without timestamps', () => {
		const route = run.map(({ lat, lon }) => ({ lat, lon }));
		expect(() => parseGpxActivity(gpx(route), now)).toThrow(/no timestamps/);
	});

	it('rejects non-GPX and empty tracks', () => {
		expect(() => parseGpxActivity('hello', now)).toThrow(UploadError);
		expect(() => parseGpxActivity(gpx([]), now)).toThrow(/recorded track/);
	});

	it('rejects tracks dated in the future', () => {
		expect(() => parseGpxActivity(gpx(run), new Date('2027-01-01T00:00:00Z'))).toThrow(/future/);
	});

	it('sorts out-of-order points', () => {
		const a = parseGpxActivity(gpx([...run].reverse()), now);
		expect(a.timed[0].t).toBe(0);
		expect(a.timed[0].point.lat).toBeCloseTo(-19.3);
	});
});

describe('trackFingerprint', () => {
	it('is stable for the same track and differs for another', async () => {
		const a = await trackFingerprint(parseGpxActivity(gpx(run), now));
		const b = await trackFingerprint(parseGpxActivity(gpx(run, 'Renamed'), now));
		const c = await trackFingerprint(parseGpxActivity(gpx(run.slice(1)), now));
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});
});
