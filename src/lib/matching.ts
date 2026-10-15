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
