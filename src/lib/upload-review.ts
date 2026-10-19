/**
 * Suspicious-upload review (#248). Pure heuristics that flag an uploaded run for
 * an admin to look at; nothing here rejects an upload on its own.
 */
import type { ParsedActivity } from './activity-file';
import { haversineMeters } from './geo';

/** Faster than this average over a whole run is not a human on foot: ~2:13/km. */
export const MAX_AVG_SPEED_MPS = 7.5;
/** A single GPS segment implying more than ~80 km/h is a glitch or an edit. */
export const MAX_GPS_SPEED_MPS = 22;
/** One bad fix is common; several in a row are not. */
export const MAX_GPS_JUMPS = 2;

function formatPace(secondsPerKm: number): string {
	const total = Math.round(secondsPerKm);
	const minutes = Math.floor(total / 60);
	const seconds = String(total % 60).padStart(2, '0');
	return `${minutes}:${seconds}`;
}

/**
 * Return a short admin-facing reason when the upload looks wrong, else null.
 * `duplicateByOtherRunner` comes from the database (same track fingerprint
 * already stored for a different runner).
 */
export function reviewUpload(
	activity: ParsedActivity,
	options: { duplicateByOtherRunner?: boolean } = {}
): string | null {
	if (options.duplicateByOtherRunner) {
		return 'The same track was already uploaded by another runner.';
	}

	const { distanceM, elapsedS, timed } = activity;
	if (distanceM >= 500 && elapsedS > 0) {
		const speed = distanceM / elapsedS;
		if (speed > MAX_AVG_SPEED_MPS) {
			return `Implausibly fast average pace (${formatPace(elapsedS / (distanceM / 1000))}/km).`;
		}
	}

	let jumps = 0;
	for (let i = 1; i < timed.length; i += 1) {
		const dt = timed[i].t - timed[i - 1].t;
		if (dt <= 0) continue;
		if (haversineMeters(timed[i - 1].point, timed[i].point) / dt > MAX_GPS_SPEED_MPS) jumps += 1;
	}
	if (jumps >= MAX_GPS_JUMPS) {
		return `GPS jumps: ${jumps} segments imply more than 80 km/h.`;
	}

	return null;
}
