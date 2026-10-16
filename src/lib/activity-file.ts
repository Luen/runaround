/**
 * Runner activity uploads (#205): parse and validate a GPX track with timestamps.
 * Pure (no DB) so it is unit-tested and shared by the upload action.
 */
import { haversineMeters, type LngLat } from './geo';
import type { TimedPoint } from './matching';

/** Vercel functions cap request bodies at 4.5 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Matching cost grows with points; ~1 point per 2 s is plenty. */
export const UPLOAD_SAMPLE_S = 2;

export type ParsedActivity = {
	name: string;
	startedAt: Date;
	elapsedS: number;
	distanceM: number;
	/** `t` = seconds since `startedAt`. */
	timed: TimedPoint[];
};

export class UploadError extends Error {}

function attr(tag: string, name: string): number | null {
	const m = new RegExp(`\\b${name}="([^"]+)"`, 'i').exec(tag);
	if (!m) return null;
	const n = Number(m[1]);
	return Number.isFinite(n) ? n : null;
}

export function parseGpxActivity(xml: string, now: Date = new Date()): ParsedActivity {
	if (!/<gpx[\s>]/i.test(xml)) throw new UploadError('That file is not a GPX file.');
	const name =
		/<trk>[\s\S]*?<name>([^<]{1,200})<\/name>/i.exec(xml)?.[1]?.trim() ||
		/<metadata>[\s\S]*?<name>([^<]{1,200})<\/name>/i.exec(xml)?.[1]?.trim() ||
		'Uploaded run';

	const raw: { point: LngLat; ms: number }[] = [];
	const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;
	let m: RegExpExecArray | null;
	let untimed = 0;
	while ((m = re.exec(xml))) {
		const lat = attr(m[1], 'lat');
		const lng = attr(m[1], 'lon');
		if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
		const time = /<time>([^<]+)<\/time>/i.exec(m[2])?.[1];
		const ms = time ? Date.parse(time.trim()) : NaN;
		if (Number.isNaN(ms)) {
			untimed += 1;
			continue;
		}
		raw.push({ point: { lat, lng }, ms });
	}
	if (raw.length < 2) {
		throw new UploadError(
			untimed > 0
				? 'This GPX has no timestamps. Export the recorded activity (not a planned route).'
				: 'This GPX does not contain a recorded track.'
		);
	}

	raw.sort((a, b) => a.ms - b.ms);
	const start = raw[0].ms;
	const end = raw[raw.length - 1].ms;
	if (end <= start) throw new UploadError('The track timestamps do not move forward.');
	if (end > now.getTime() + 60 * 60 * 1000)
		throw new UploadError('The track is dated in the future.');

	const timed: TimedPoint[] = [];
	let distanceM = 0;
	let lastKept = -Infinity;
	for (let i = 0; i < raw.length; i += 1) {
		if (i > 0) distanceM += haversineMeters(raw[i - 1].point, raw[i].point);
		const isLast = i === raw.length - 1;
		if (raw[i].ms - lastKept >= UPLOAD_SAMPLE_S * 1000 || isLast) {
			timed.push({ point: raw[i].point, t: (raw[i].ms - start) / 1000 });
			lastKept = raw[i].ms;
		}
	}

	return {
		name,
		startedAt: new Date(start),
		elapsedS: Math.round((end - start) / 1000),
		distanceM,
		timed
	};
}

/** Stable fingerprint of a track, so the same file/run isn't counted twice. */
export async function trackFingerprint(activity: ParsedActivity): Promise<string> {
	const sig = activity.timed
		.map((p) => `${Math.round(p.t)}:${p.point.lat.toFixed(5)},${p.point.lng.toFixed(5)}`)
		.join(';');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sig));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
