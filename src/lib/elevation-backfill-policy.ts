/** True when a race has a course but no stored elevation gain yet. */
export function needsElevationBackfill(race: {
	elevationGainM: number | null;
	courseGeojson: { coordinates?: unknown[] } | null;
}): boolean {
	return (
		!(race.elevationGainM && race.elevationGainM > 0) &&
		(race.courseGeojson?.coordinates?.length ?? 0) >= 2
	);
}

/** Reject if `promise` hasn't settled within `ms` (the work itself keeps running). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
