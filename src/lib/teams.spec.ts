import { describe, expect, it } from 'vitest';
import { courseEffortPoints, matchActivityToCourse, type TimedPoint } from './matching';
import {
	DEFAULT_TEAM_RULES,
	downsampleTrace,
	findTeams,
	positionAt,
	ranTogether,
	type TeamCandidate,
	type TracePoint
} from './teams';

const T0 = Date.parse('2027-03-06T21:00:00Z');
// ~0.009° lat ≈ 1 km. Runners head north 1 km every 6 min for 60 min.
function trace(
	opts: { startOffsetS?: number; latOffset?: number; lngOffset?: number; durS?: number } = {}
): TracePoint[] {
	const { startOffsetS = 0, latOffset = 0, lngOffset = 0, durS = 3600 } = opts;
	const pts: TracePoint[] = [];
	for (let s = 0; s <= durS; s += 10) {
		pts.push([
			T0 + (startOffsetS + s) * 1000,
			-19.3 + latOffset + (s / 360) * 0.009,
			146.75 + lngOffset
		]);
	}
	return pts;
}

function cand(id: string, t: TracePoint[], who = id): TeamCandidate {
	return {
		attemptId: id,
		participantKey: who,
		name: `Runner ${who}`,
		timeMs: t[t.length - 1][0] - t[0][0],
		trace: t
	};
}

describe('positionAt', () => {
	it('interpolates between points and is null outside', () => {
		const t: TracePoint[] = [
			[0, 0, 0],
			[10, 1, 2]
		];
		expect(positionAt(t, 5)).toEqual({ lat: 0.5, lng: 1 });
		expect(positionAt(t, 11)).toBeNull();
	});
});

describe('downsampleTrace', () => {
	it('keeps first/last and thins to the interval', () => {
		const out = downsampleTrace(trace({ durS: 100 }), 30);
		expect(out[0][0]).toBe(T0);
		expect(out[out.length - 1][0]).toBe(T0 + 100_000);
		expect(out.length).toBe(5);
	});
});

describe('ranTogether', () => {
	it('rejects off-course separation after extracting the matched effort', () => {
		const course = Array.from({ length: 61 }, (_, i) => ({
			lat: -19.3 + (i / 60) * 0.002,
			lng: 146.75
		}));
		const a: TimedPoint[] = course.map((point, i) => ({ point, t: i * 10 }));
		const b = a.map((p, i) => ({
			...p,
			point: { ...p.point, lng: i >= 15 && i <= 45 ? 146.78 : 146.75 }
		}));
		// The runner returns later to cover the missing part of the course.
		for (let i = 15; i <= 45; i++) b.push({ point: course[i], t: 600 + i * 10 });
		b.push({ point: course[60], t: 1200 });
		const together = [...a, ...a.map((p) => ({ ...p, t: p.t + 610 }))];
		expect(matchActivityToCourse({ course, activity: b, surface: 'trail' }).ok).toBe(true);
		const toTrace = (pts: TimedPoint[]): TracePoint[] =>
			downsampleTrace(
				courseEffortPoints(pts, course, 'trail').map((p) => [
					T0 + p.t * 1000,
					p.point.lat,
					p.point.lng
				])
			);
		expect(ranTogether(toTrace(together), toTrace(b))).toBe(false);
		expect(courseEffortPoints(b, course, 'trail').some((p) => p.point.lng === 146.78)).toBe(true);
	});
	it('trims only the lead-in and tail outside the course', () => {
		const point = { lat: -19.3, lng: 146.75 };
		const outside = { lat: -20, lng: 146 };
		const activity = [outside, point, outside, point, outside].map((point, t) => ({ point, t }));
		expect(courseEffortPoints(activity, [point], 'trail')).toEqual(activity.slice(1, 4));
		expect(courseEffortPoints(activity, [], 'trail')).toEqual([]);
	});
	it('is true for runners side by side', () => {
		expect(ranTogether(trace(), trace({ lngOffset: 0.001, startOffsetS: 20 }))).toBe(true);
	});
	it('is false when starts are far apart', () => {
		expect(ranTogether(trace(), trace({ startOffsetS: 900 }))).toBe(false);
	});
	it('is false when one runner drifts beyond 1 km mid-run', () => {
		const far = trace().map(
			([t, lat, lng], i) => [t, i > 150 && i < 250 ? lat + 0.02 : lat, lng] as TracePoint
		);
		expect(ranTogether(trace(), far)).toBe(false);
	});
});

describe('findTeams', () => {
	const group = (prefix: string, startOffsetS: number, extraS = 0) =>
		[0, 1, 2, 3].map((k) =>
			cand(
				`${prefix}${k}`,
				trace({
					startOffsetS: startOffsetS + k * 15,
					lngOffset: k * 0.001,
					durS: 3600 + extraS + k * 10
				})
			)
		);

	it('links four runners who stayed together and averages their times', () => {
		const teams = findTeams(group('a', 0));
		expect(teams).toHaveLength(1);
		expect(teams[0].members).toHaveLength(4);
		expect(teams[0].timeMs).toBe((3600_000 + 3610_000 + 3620_000 + 3630_000) / 4);
	});

	it('ranks teams fastest first and ignores solo runners', () => {
		const slow = group('s', 7200, 600);
		const fast = group('f', 0);
		const solo = cand('solo', trace({ startOffsetS: 20000 }));
		const teams = findTeams([...slow, solo, ...fast]);
		expect(teams.map((t) => t.members[0].attemptId[0])).toEqual(['f', 's']);
		expect(teams.map((t) => t.rank)).toEqual([1, 2]);
	});

	it('does not form a team from 3 or 5 runners', () => {
		expect(findTeams(group('a', 0).slice(0, 3))).toEqual([]);
		const five = [...group('a', 0), cand('a4', trace({ startOffsetS: 30, lngOffset: 0.002 }))];
		expect(findTeams(five)).toEqual([]);
	});

	it('does not link a group where one runner split off', () => {
		const g = group('a', 0);
		g[3] = cand(
			'a3',
			g[3].trace.map(([t, lat, lng], i) => [t, i > 100 ? lat + 0.03 : lat, lng] as TracePoint)
		);
		expect(findTeams(g)).toEqual([]);
	});

	it('requires four distinct runners', () => {
		const g = group('a', 0);
		g[3] = { ...g[3], participantKey: g[0].participantKey };
		expect(findTeams(g)).toEqual([]);
	});

	it('respects a custom team size', () => {
		expect(findTeams(group('a', 0).slice(0, 2), { ...DEFAULT_TEAM_RULES, size: 2 })).toHaveLength(
			1
		);
	});
});
