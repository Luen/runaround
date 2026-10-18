import type { LngLat } from './geo';
import { haversineMeters } from './geo';

export const ROAD_BUFFER_M = 25;
export const TRAIL_BUFFER_M = 60;
export const COVERAGE_THRESHOLD = 0.85;

export type TimedPoint = { point: LngLat; t: number };

export type MatchResult =
	| {
			ok: true;
			coverage: number;
			timeMs: number;
	  }
	| {
			ok: false;
			coverage: number;
			reason: 'low_coverage' | 'no_time';
	  };

export function bufferForSurface(surface: 'road' | 'trail'): number {
	return surface === 'road' ? ROAD_BUFFER_M : TRAIL_BUFFER_M;
}

export function courseCoverage(course: LngLat[], activity: LngLat[], bufferMeters: number): number {
	if (course.length === 0) return 0;
	let hit = 0;
	for (const c of course) {
		if (activity.some((p) => haversineMeters(c, p) <= bufferMeters)) hit += 1;
	}
	return hit / course.length;
}

/** Trim to first/last course contact, retaining excursions between them. */
export function courseEffortPoints(
	activity: TimedPoint[],
	course: LngLat[],
	surface: 'road' | 'trail'
): TimedPoint[] {
	const buffer = bufferForSurface(surface);
	const touchesCourse = (a: TimedPoint) =>
		course.some((c) => haversineMeters(a.point, c) <= buffer);
	const first = activity.findIndex(touchesCourse);
	if (first < 0) return [];
	const last = activity.findLastIndex(touchesCourse);
	return activity.slice(first, last + 1);
}

export function timeOnCourseMs(
	activity: TimedPoint[],
	course: LngLat[],
	bufferMeters: number
): number | null {
	const matched = activity.filter((a) =>
		course.some((c) => haversineMeters(a.point, c) <= bufferMeters)
	);
	if (matched.length < 2) return null;
	const first = matched[0];
	const last = matched[matched.length - 1];
	const delta = (last.t - first.t) * 1000;
	return delta > 0 ? delta : null;
}

export function matchActivityToCourse(opts: {
	course: LngLat[];
	activity: TimedPoint[];
	surface: 'road' | 'trail';
	threshold?: number;
}): MatchResult {
	const buffer = bufferForSurface(opts.surface);
	const activityPoints = opts.activity.map((a) => a.point);
	const coverage = courseCoverage(opts.course, activityPoints, buffer);
	const threshold = opts.threshold ?? COVERAGE_THRESHOLD;
	if (coverage < threshold) {
		return { ok: false, coverage, reason: 'low_coverage' };
	}
	const timeMs = timeOnCourseMs(opts.activity, opts.course, buffer);
	if (timeMs === null) {
		return { ok: false, coverage, reason: 'no_time' };
	}
	return { ok: true, coverage, timeMs };
}

/** First appearance is not an email-worthy gain; only a strictly better place is. */
export function rankImproved(previous: number | null, next: number): boolean {
	return previous !== null && next < previous;
}

export function computeRaceStatus(startsAt: Date, endsAt: Date, now = new Date()) {
	if (now < startsAt) return 'upcoming' as const;
	if (now <= endsAt) return 'live' as const;
	return 'closed' as const;
}

export function inRaceWindow(startedAt: Date, startsAt: Date, endsAt: Date): boolean {
	return startedAt >= startsAt && startedAt <= endsAt;
}

/**
 * The status a race should display right now. Stored `status` can be stale because
 * only the worker advances `upcoming → live → closed` (#221); draft races stay draft.
 */
export function effectiveRaceStatus(
	race: { status: string; startsAt: Date; endsAt: Date },
	now = new Date()
): 'draft' | 'upcoming' | 'live' | 'closed' {
	if (race.status === 'draft') return 'draft';
	return computeRaceStatus(race.startsAt, race.endsAt, now);
}

/**
 * Pair GPS points with their timestamps. Both streams are required: without real
 * times a run cannot be timed, and fabricating indexes produced bogus times (#223).
 */
export function timedPointsFromStreams(
	latlng: [number, number][] | undefined | null,
	times: number[] | undefined | null
): { timed: TimedPoint[]; hasTime: boolean } {
	if (!latlng?.length || !times?.length) return { timed: [], hasTime: false };
	const count = Math.min(latlng.length, times.length);
	if (count < 2) return { timed: [], hasTime: false };
	return {
		hasTime: true,
		timed: latlng.slice(0, count).map(([lat, lng], i) => ({ point: { lat, lng }, t: times[i] }))
	};
}
