import { haversineMeters, type LineString } from './geo';

/**
 * Elevation helpers shared by the server (GPX upload / backfill) and tests.
 * Approach mirrors gpx.studio: when a GPX has no usable <ele>, sample a
 * terrarium-encoded DEM (Mapterhorn) with bilinear interpolation, then smooth
 * over a distance window before summing climbs.
 */

export const MAPTERHORN_TILE_URL = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const MAPTERHORN_TILE_SIZE = 512;
export const MAPTERHORN_ATTRIBUTION_URL = 'https://mapterhorn.com/attribution';

/** Per-<trkpt> elevation in document order (null when the point has no <ele>). */
export function parseGpxElevations(xml: string): (number | null)[] {
	const out: (number | null)[] = [];
	const re = /<trkpt\b[^>]*?(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(xml))) {
		const inner = match[1] ?? '';
		const ele = /<ele>\s*([^<]+?)\s*<\/ele>/i.exec(inner);
		const value = ele ? Number(ele[1]) : NaN;
		out.push(Number.isFinite(value) ? value : null);
	}
	return out;
}

/**
 * True when elevations are present for (nearly) every point and are not all ~0.
 * Exports from route planners often omit <ele> or write 0 everywhere.
 */
export function hasUsableElevation(elevations: (number | null)[], pointCount: number): boolean {
	if (pointCount < 2 || elevations.length !== pointCount) return false;
	const present = elevations.filter((e): e is number => e !== null);
	if (present.length < pointCount * 0.9) return false;
	return present.some((e) => Math.abs(e) > 0.5);
}

/** Fill gaps (null) by linear interpolation along the index; ends copy nearest value. */
export function fillGaps(values: (number | null)[]): number[] {
	const out = new Array<number>(values.length);
	let last = -1;
	for (let i = 0; i < values.length; i += 1) {
		const v = values[i];
		if (v === null) continue;
		if (last === -1) {
			for (let j = 0; j < i; j += 1) out[j] = v;
		} else {
			const a = values[last] as number;
			for (let j = last + 1; j < i; j += 1) out[j] = a + ((v - a) * (j - last)) / (i - last);
		}
		out[i] = v;
		last = i;
	}
	if (last === -1) return values.map(() => 0);
	for (let j = last + 1; j < values.length; j += 1) out[j] = values[last] as number;
	return out;
}

/** Decode a terrarium RGB pixel to metres. */
export function decodeTerrarium(r: number, g: number, b: number): number {
	return r * 256 + g + b / 256 - 32768;
}

/** Web Mercator global pixel coordinate at zoom `z` for a given tile size. */
export function lngLatToPixel(
	lng: number,
	lat: number,
	z: number,
	tileSize = MAPTERHORN_TILE_SIZE
): { px: number; py: number } {
	const scale = tileSize * 2 ** z;
	const clampedLat = Math.max(-85.0511287, Math.min(85.0511287, lat));
	const sin = Math.sin((clampedLat * Math.PI) / 180);
	const px = ((lng + 180) / 360) * scale;
	const py = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
	return { px, py };
}

/** Decoded DEM tile: row-major elevations of size×size. */
export type DemTile = { size: number; data: Float32Array };

export function demTileFromRgba(rgba: Uint8Array | Buffer, size: number, channels = 4): DemTile {
	const data = new Float32Array(size * size);
	for (let i = 0; i < size * size; i += 1) {
		const o = i * channels;
		data[i] = decodeTerrarium(rgba[o], rgba[o + 1], rgba[o + 2]);
	}
	return { size, data };
}

/**
 * Bilinear sample at global pixel (px, py). `getPixel` returns the elevation of an
 * integer global pixel (may cross tile boundaries). Pixel centres sit at +0.5.
 */
export function bilinear(
	px: number,
	py: number,
	getPixel: (x: number, y: number) => number
): number {
	const x = px - 0.5;
	const y = py - 0.5;
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;
	const a = getPixel(x0, y0);
	const b = getPixel(x0 + 1, y0);
	const c = getPixel(x0, y0 + 1);
	const d = getPixel(x0 + 1, y0 + 1);
	return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Cumulative distance (m) along a LineString. */
export function cumulativeDistances(geojson: LineString): number[] {
	const out = [0];
	const c = geojson.coordinates;
	for (let i = 1; i < c.length; i += 1) {
		out.push(
			out[i - 1] +
				haversineMeters({ lng: c[i - 1][0], lat: c[i - 1][1] }, { lng: c[i][0], lat: c[i][1] })
		);
	}
	return out;
}

/** Moving average over a distance window (metres, total width) centred on each point. */
export function smoothByDistance(
	elevations: number[],
	distances: number[],
	windowM = 100
): number[] {
	const half = windowM / 2;
	const out = new Array<number>(elevations.length);
	let lo = 0;
	let hi = 0;
	let sum = 0;
	for (let i = 0; i < elevations.length; i += 1) {
		while (hi < elevations.length && distances[hi] <= distances[i] + half) {
			sum += elevations[hi];
			hi += 1;
		}
		while (distances[lo] < distances[i] - half) {
			sum -= elevations[lo];
			lo += 1;
		}
		out[i] = sum / (hi - lo);
	}
	return out;
}

/** Total positive elevation change (m) after distance-window smoothing. */
export function elevationGain(elevations: number[], geojson: LineString, windowM = 100): number {
	if (elevations.length < 2 || elevations.length !== geojson.coordinates.length) return 0;
	const smooth = smoothByDistance(elevations, cumulativeDistances(geojson), windowM);
	let gain = 0;
	for (let i = 1; i < smooth.length; i += 1) {
		const d = smooth[i] - smooth[i - 1];
		if (d > 0) gain += d;
	}
	return gain;
}
