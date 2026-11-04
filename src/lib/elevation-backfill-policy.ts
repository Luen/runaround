import { hasUsableElevation, parseGpxElevations } from './elevation';

/**
 * True when a race has a course but no stored elevation gain yet. A race whose
 * stored GPX already carries usable `<ele>` has been enriched — even when the
 * gain is a genuine 0 m — so it must not trigger the DEM lookup again (#236).
 */
export function needsElevationBackfill(race: {
	elevationGainM: number | null;
	courseGeojson: { coordinates?: unknown[] } | null;
	gpx?: string | null;
}): boolean {
	if (race.elevationGainM && race.elevationGainM > 0) return false;
	const pointCount = race.courseGeojson?.coordinates?.length ?? 0;
	if (pointCount < 2) return false;
	if (race.gpx && hasUsableElevation(parseGpxElevations(race.gpx), pointCount)) return false;
	return true;
}

/** Reject if `promise` hasn't settled within `ms` (the work itself keeps running). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
