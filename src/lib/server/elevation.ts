import sharp from 'sharp';
import { geojsonToGpx, parseGpxToLineString, type LineString } from '../geo';
import {
	MAPTERHORN_TILE_SIZE,
	MAPTERHORN_TILE_URL,
	bilinear,
	demTileFromRgba,
	elevationGain,
	fillGaps,
	hasUsableElevation,
	lngLatToPixel,
	parseGpxElevations,
	type DemTile
} from '../elevation';

/** z13 ≈ 9 m/px at Townsville's latitude with 512px tiles; Mapterhorn may not have it everywhere. */
const ZOOMS = [13, 12, 11];
const CACHE_MAX = 128;
const tileCache = new Map<string, Promise<DemTile | null>>();

async function fetchTile(z: number, x: number, y: number): Promise<DemTile | null> {
	const n = 2 ** z;
	const wx = ((x % n) + n) % n;
	if (y < 0 || y >= n) return null;
	const url = MAPTERHORN_TILE_URL.replace('{z}', String(z))
		.replace('{x}', String(wx))
		.replace('{y}', String(y));
	const res = await fetch(url, { headers: { 'User-Agent': 'RunAround (runaround.com.au)' } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Mapterhorn tile ${z}/${wx}/${y}: HTTP ${res.status}`);
	const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return demTileFromRgba(data, info.width, info.channels);
}

/** Cached (in-process, LRU-ish) tile loader. */
export function getTile(z: number, x: number, y: number): Promise<DemTile | null> {
	const key = `${z}/${x}/${y}`;
	const hit = tileCache.get(key);
	if (hit) {
		tileCache.delete(key);
		tileCache.set(key, hit);
		return hit;
	}
	const p = fetchTile(z, x, y).catch((err) => {
		tileCache.delete(key);
		throw err;
	});
	tileCache.set(key, p);
	while (tileCache.size > CACHE_MAX) {
		const oldest = tileCache.keys().next().value as string;
		tileCache.delete(oldest);
	}
	return p;
}

async function sampleAtZoom(coords: [number, number][], z: number): Promise<number[] | null> {
	const size = MAPTERHORN_TILE_SIZE;
	const pixels = coords.map(([lng, lat]) => lngLatToPixel(lng, lat, z, size));
	const needed = new Set<string>();
	for (const { px, py } of pixels) {
		const x0 = Math.floor(px - 0.5);
		const y0 = Math.floor(py - 0.5);
		for (const [gx, gy] of [
			[x0, y0],
			[x0 + 1, y0 + 1]
		]) {
			needed.add(`${Math.floor(gx / size)}/${Math.floor(gy / size)}`);
		}
		needed.add(`${Math.floor((x0 + 1) / size)}/${Math.floor(y0 / size)}`);
		needed.add(`${Math.floor(x0 / size)}/${Math.floor((y0 + 1) / size)}`);
	}
	const tiles = new Map<string, DemTile>();
	for (const key of needed) {
		const [tx, ty] = key.split('/').map(Number);
		const tile = await getTile(z, tx, ty);
		if (!tile) return null;
		tiles.set(key, tile);
	}
	const getPixel = (gx: number, gy: number) => {
		const tile = tiles.get(`${Math.floor(gx / size)}/${Math.floor(gy / size)}`)!;
		const lx = gx - Math.floor(gx / size) * size;
		const ly = gy - Math.floor(gy / size) * size;
		return tile.data[ly * tile.size + lx];
	};
	return pixels.map(({ px, py }) => bilinear(px, py, getPixel));
}

/** Sample Mapterhorn DEM elevations (m) for each coordinate, falling back to lower zooms. */
export async function sampleDemElevations(geojson: LineString): Promise<number[]> {
	for (const z of ZOOMS) {
		const result = await sampleAtZoom(geojson.coordinates, z);
		if (result) return result.map((e) => Math.round(e * 10) / 10);
	}
	throw new Error('No Mapterhorn elevation tiles cover this course');
}

export type CourseElevation = {
	elevations: number[];
	elevationGainM: number;
	source: 'gpx' | 'mapterhorn';
};

/**
 * Use the GPX's own <ele> when usable; otherwise sample Mapterhorn.
 * `xml` must be the document `geojson` was parsed from (same trkpt order).
 */
export async function courseElevation(xml: string, geojson: LineString): Promise<CourseElevation> {
	const fromGpx = parseGpxElevations(xml);
	if (hasUsableElevation(fromGpx, geojson.coordinates.length)) {
		const elevations = fillGaps(fromGpx);
		return { elevations, elevationGainM: elevationGain(elevations, geojson), source: 'gpx' };
	}
	const elevations = await sampleDemElevations(geojson);
	return { elevations, elevationGainM: elevationGain(elevations, geojson), source: 'mapterhorn' };
}

/**
 * Parse an uploaded GPX and enrich it with elevation. Elevation lookup failures never
 * block saving a race: the course is stored without <ele> and gain 0 (backfill retries).
 */
export async function processUploadedGpx(title: string, xml: string) {
	const courseGeojson = parseGpxToLineString(xml);
	try {
		const { elevations, elevationGainM } = await courseElevation(xml, courseGeojson);
		return { courseGeojson, gpx: geojsonToGpx(title, courseGeojson, elevations), elevationGainM };
	} catch (err) {
		console.error('Elevation lookup failed', err);
		return { courseGeojson, gpx: geojsonToGpx(title, courseGeojson), elevationGainM: 0 };
	}
}
