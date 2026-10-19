/**
 * Runner activity uploads (#205, #213): parse and validate a GPX or FIT track
 * with timestamps. Pure (no DB) so it is unit-tested and shared by the upload action.
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

/** Sort, validate and downsample a timed track into the shared upload shape. */
function parsedFromRaw(
	name: string,
	raw: { point: LngLat; ms: number }[],
	now: Date
): ParsedActivity {
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

export function parseGpxActivity(xml: string, now: Date = new Date()): ParsedActivity {
	if (!/<gpx[\s>]/i.test(xml)) throw new UploadError('That file is not a GPX file.');
	const name =
		/<trk>[\s\S]*?<name>([^<]{1,200})<\/name>/i.exec(xml)?.[1]?.trim() ||
		/<metadata>[\s\S]*?<name>([^<]{1,200})<\/name>/i.exec(xml)?.[1]?.trim() ||
		'Uploaded run';

	const raw: { point: LngLat; ms: number }[] = [];
	let untimed = 0;
	// Linear scan: a lazy `<trkpt>...</trkpt>` regex backtracks quadratically on
	// self-closing or unclosed points, which a 4 MB upload can exploit.
	const lower = xml.toLowerCase();
	for (let i = lower.indexOf('<trkpt'); i >= 0;) {
		const next = lower.indexOf('<trkpt', i + 6);
		const chunk = xml.slice(i, next < 0 ? xml.length : next);
		i = next;
		const open = /^<trkpt\b([^>]*)>/i.exec(chunk);
		if (!open || open[1].trimEnd().endsWith('/')) continue;
		const close = chunk.toLowerCase().indexOf('</trkpt>');
		if (close < 0) continue;
		const body = chunk.slice(open[0].length, close);
		const lat = attr(open[1], 'lat');
		const lng = attr(open[1], 'lon');
		if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
		const time = /<time>([^<]+)<\/time>/i.exec(body)?.[1];
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

	return parsedFromRaw(name, raw, now);
}

/** FIT epoch is 1989-12-31T00:00:00Z; timestamps are seconds since then. */
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);
/** Position fields are signed 32-bit semicircles. */
const FIT_SEMICIRCLE_DEGREES = 180 / 2 ** 31;

type FitField = { number: number; size: number; baseType: number };
type FitDefinition = { arch: number; global: number; fields: FitField[] };

/** Base type values are `0x80 | type`, so the low five bits identify the type. */
function fitNumber(
	view: DataView,
	offset: number,
	size: number,
	baseType: number,
	little: boolean
): number | null {
	const type = baseType & 0x1f;
	const need = (n: number) => size >= n && offset + n <= view.byteLength;
	switch (type) {
		case 0x00: // enum
			return need(1) && view.getUint8(offset) !== 0xff ? view.getUint8(offset) : null;
		case 0x01: {
			if (!need(1)) return null;
			const v = view.getInt8(offset);
			return v === 0x7f ? null : v;
		}
		case 0x02: {
			if (!need(1)) return null;
			const v = view.getUint8(offset);
			return v === 0xff ? null : v;
		}
		case 0x03: {
			if (!need(2)) return null;
			const v = view.getInt16(offset, little);
			return v === 0x7fff ? null : v;
		}
		case 0x04: {
			if (!need(2)) return null;
			const v = view.getUint16(offset, little);
			return v === 0xffff ? null : v;
		}
		case 0x05: {
			if (!need(4)) return null;
			const v = view.getInt32(offset, little);
			return v === 0x7fffffff ? null : v;
		}
		case 0x06: {
			if (!need(4)) return null;
			const v = view.getUint32(offset, little);
			return v === 0xffffffff ? null : v;
		}
		case 0x08: {
			if (!need(4)) return null;
			const v = view.getFloat32(offset, little);
			return Number.isFinite(v) ? v : null;
		}
		case 0x09: {
			if (!need(8)) return null;
			const v = view.getFloat64(offset, little);
			return Number.isFinite(v) ? v : null;
		}
		case 0x0a: {
			if (!need(1)) return null;
			const v = view.getUint8(offset);
			return v === 0 ? null : v;
		}
		case 0x0b: {
			if (!need(2)) return null;
			const v = view.getUint16(offset, little);
			return v === 0 ? null : v;
		}
		case 0x0c: {
			if (!need(4)) return null;
			const v = view.getUint32(offset, little);
			return v === 0 ? null : v;
		}
		case 0x0d: // raw byte
			return need(1) ? view.getUint8(offset) : null;
		default:
			return null;
	}
}

function fitSignature(bytes: Uint8Array, offset: number): boolean {
	return (
		bytes[offset] === 0x2e && // .
		bytes[offset + 1] === 0x46 && // F
		bytes[offset + 2] === 0x49 && // I
		bytes[offset + 3] === 0x54 // T
	);
}

/**
 * Parse the position/timestamp records from a FIT activity (#213).
 *
 * Implements only the FIT messages needed for matching: definition messages and
 * record (global 20) data, including compressed timestamp headers. Position
 * fields are converted from semicircles and timestamps from the 1989-12-31 epoch.
 */
export function parseFitActivity(
	data: ArrayBuffer | Uint8Array,
	name = 'Uploaded run',
	now: Date = new Date()
): ParsedActivity {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	if (bytes.length < 12) throw new UploadError('That file is not a FIT file.');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const headerSize = view.getUint8(0);
	if (headerSize < 12 || headerSize > 14 || bytes.length < headerSize || !fitSignature(bytes, 8)) {
		throw new UploadError('That file is not a FIT file.');
	}
	const dataSize = view.getUint32(4, true);
	if (headerSize + dataSize > bytes.length) {
		throw new UploadError('This FIT file is incomplete.');
	}
	const end = headerSize + dataSize;
	const definitions = new Map<number, FitDefinition>();
	const raw: { point: LngLat; ms: number }[] = [];
	let timestampedRecords = 0;
	let lastTimestampS: number | null = null;
	let lastOffset = 0;
	const ensure = (offset: number, length: number) => {
		if (offset + length > end) throw new UploadError('This FIT file is damaged.');
	};

	let offset = headerSize;
	while (offset < end) {
		const header = view.getUint8(offset);
		offset += 1;

		if (header & 0x80) {
			// Compressed timestamp header: bits 5-6 select the definition, low 5 bits
			// are the offset from the previous timestamp (rollover after 32 s).
			const local = (header >> 5) & 0x03;
			const timeOffset = header & 0x1f;
			const definition = definitions.get(local);
			if (!definition) throw new UploadError('This FIT file is damaged.');
			if (lastTimestampS === null) {
				throw new UploadError('This FIT has no starting timestamp.');
			}
			lastTimestampS += (timeOffset - lastOffset + 32) % 32;
			lastOffset = timeOffset;
			timestampedRecords += 1;
			let lat: number | null = null;
			let lng: number | null = null;
			for (const field of definition.fields) {
				// The compressed timestamp replaces field 253, which is omitted from
				// the data message (so it does not consume field.size bytes here).
				if (field.number === 253) continue;
				if (definition.global === 20 && field.number === 0) {
					const value = fitNumber(view, offset, field.size, field.baseType, definition.arch === 0);
					if (value !== null) lat = value * FIT_SEMICIRCLE_DEGREES;
				} else if (definition.global === 20 && field.number === 1) {
					const value = fitNumber(view, offset, field.size, field.baseType, definition.arch === 0);
					if (value !== null) lng = value * FIT_SEMICIRCLE_DEGREES;
				}
				offset += field.size;
			}
			ensure(offset, 0);
			if (
				definition.global === 20 &&
				lat !== null &&
				lng !== null &&
				Math.abs(lat) <= 90 &&
				Math.abs(lng) <= 180
			) {
				raw.push({
					point: { lat, lng },
					ms: (lastTimestampS + FIT_EPOCH_MS / 1000) * 1000
				});
			}
			continue;
		}

		const local = header & 0x0f;
		if (header & 0x40) {
			// Definition message. Architecture 0 is little-endian, 1 is big-endian.
			ensure(offset, 5);
			offset += 1; // reserved
			const arch = view.getUint8(offset);
			offset += 1;
			const little = arch === 0;
			const global = view.getUint16(offset, little);
			offset += 2;
			const fieldCount = view.getUint8(offset);
			offset += 1;
			ensure(offset, fieldCount * 3);
			const fields: FitField[] = [];
			for (let i = 0; i < fieldCount; i += 1) {
				fields.push({
					number: view.getUint8(offset),
					size: view.getUint8(offset + 1),
					baseType: view.getUint8(offset + 2)
				});
				offset += 3;
			}
			if (header & 0x20) {
				ensure(offset, 1);
				const developerFields = view.getUint8(offset);
				offset += 1;
				ensure(offset, developerFields * 3);
				offset += developerFields * 3;
			}
			definitions.set(local, { arch, global, fields });
			continue;
		}

		const definition = definitions.get(local);
		if (!definition) throw new UploadError('This FIT file is damaged.');
		let timestampS: number | null = null;
		let lat: number | null = null;
		let lng: number | null = null;
		for (const field of definition.fields) {
			if (definition.global === 20 && field.number === 253) {
				timestampS = fitNumber(view, offset, field.size, field.baseType, definition.arch === 0);
			} else if (definition.global === 20 && field.number === 0) {
				const value = fitNumber(view, offset, field.size, field.baseType, definition.arch === 0);
				if (value !== null) lat = value * FIT_SEMICIRCLE_DEGREES;
			} else if (definition.global === 20 && field.number === 1) {
				const value = fitNumber(view, offset, field.size, field.baseType, definition.arch === 0);
				if (value !== null) lng = value * FIT_SEMICIRCLE_DEGREES;
			}
			offset += field.size;
		}
		ensure(offset, 0);
		if (timestampS !== null) {
			lastTimestampS = timestampS;
			lastOffset = 0;
			timestampedRecords += 1;
			if (
				definition.global === 20 &&
				lat !== null &&
				lng !== null &&
				Math.abs(lat) <= 90 &&
				Math.abs(lng) <= 180
			) {
				raw.push({
					point: { lat, lng },
					ms: (timestampS + FIT_EPOCH_MS / 1000) * 1000
				});
			}
		}
	}

	if (raw.length < 2) {
		throw new UploadError(
			timestampedRecords > 0
				? 'This FIT does not contain a recorded GPS track.'
				: 'This FIT has no timestamps. Export the recorded activity (not a planned route).'
		);
	}
	return parsedFromRaw(name.slice(0, 200), raw, now);
}

/** Stable fingerprint of a track, so the same file/run isn't counted twice. */
export async function trackFingerprint(activity: ParsedActivity): Promise<string> {
	const sig = activity.timed
		.map((p) => `${Math.round(p.t)}:${p.point.lat.toFixed(5)},${p.point.lng.toFixed(5)}`)
		.join(';');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sig));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
