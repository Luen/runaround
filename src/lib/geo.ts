export type LngLat = { lng: number; lat: number };

export type LineString = {
	type: 'LineString';
	coordinates: [number, number][];
};

const EARTH_M = 6_371_000;

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LngLat, b: LngLat): number {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const sinLat = Math.sin(dLat / 2);
	const sinLng = Math.sin(dLng / 2);
	const h =
		sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
	return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Decode a Google encoded polyline into lng/lat points. */
export function decodePolyline(encoded: string, precision = 5): LngLat[] {
	const factor = Math.pow(10, precision);
	const coordinates: LngLat[] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;

	while (index < encoded.length) {
		let shift = 0;
		let result = 0;
		let byte: number;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		const dlat = result & 1 ? ~(result >> 1) : result >> 1;
		lat += dlat;

		shift = 0;
		result = 0;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		const dlng = result & 1 ? ~(result >> 1) : result >> 1;
		lng += dlng;

		coordinates.push({ lat: lat / factor, lng: lng / factor });
	}

	return coordinates;
}

export function lineStringGeoJSON(points: LngLat[]): LineString {
	return {
		type: 'LineString',
		coordinates: points.map((p) => [p.lng, p.lat])
	};
}

export function pointsFromLineString(geojson: LineString): LngLat[] {
	if (geojson.type !== 'LineString') return [];
	return geojson.coordinates.map(([lng, lat]) => ({ lng, lat }));
}

export function parseClockToMs(value: string): number | null {
	const trimmed = value.trim();
	const parts = trimmed.split(':').map((p) => Number(p));
	if (parts.some((n) => Number.isNaN(n))) return null;
	if (parts.length === 2) {
		return (parts[0] * 60 + parts[1]) * 1000;
	}
	if (parts.length === 3) {
		return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
	}
	return null;
}

export function formatDuration(ms: number): string {
	const total = Math.round(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) {
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseLegacyDate(value: string): Date | null {
	const cleaned = value.replace(/\s+/g, ' ').trim();
	const parsed = Date.parse(cleaned);
	if (!Number.isNaN(parsed)) return new Date(parsed);
	return null;
}

/** Parse D/M/YY windows from the old build.js format. */
export function parseDmy(value: string): Date {
	const [d, m, y] = value.split('/').map((n) => Number(n));
	const year = y < 100 ? 2000 + y : y;
	return new Date(Date.UTC(year, m - 1, d));
}

export function startOfUtcDay(date: Date): Date {
	const d = new Date(date);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

export function endOfUtcDay(date: Date): Date {
	const d = new Date(date);
	d.setUTCHours(23, 59, 59, 999);
	return d;
}

export function endOfLocalDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
}

export function geojsonToGpx(name: string, geojson: LineString): string {
	const pts = geojson.coordinates
		.map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunAround" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function parseGpxToLineString(xml: string): LineString {
	const points: [number, number][] = [];
	const re = /<trkpt\b[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(xml))) {
		points.push([Number(match[2]), Number(match[1])]);
	}
	if (points.length === 0) {
		const re2 = /<trkpt\b[^>]*\blon="([^"]+)"[^>]*\blat="([^"]+)"[^>]*>/gi;
		while ((match = re2.exec(xml))) {
			points.push([Number(match[1]), Number(match[2])]);
		}
	}
	if (points.length < 2) {
		throw new Error('GPX file does not contain a usable track');
	}
	return { type: 'LineString', coordinates: points };
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}


/** True when a response Content-Type looks like JSON / GeoJSON (not HTML login pages). */
export function isJsonLikeContentType(contentType: string): boolean {
	const ct = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
	return (
		ct === 'application/json' ||
		ct === 'application/geo+json' ||
		ct.endsWith('+json') ||
		ct === 'text/json'
	);
}

/** Public path for a race course GeoJSON overlay (`application/geo+json`). */
export function raceCourseJsonUrl(slug: string): string {
	return `/races/${encodeURIComponent(slug)}/course.json`;
}


/** Stable HSL colour from a race id/slug (same id → same colour every load). */
export function colorForRaceId(id: string): string {
	let h = 2166136261;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	const hue = (h >>> 0) % 360;
	// Fixed S/L so courses stay readable on outdoors + satellite.
	return `hsl(${hue} 72% 42%)`;
}

/** GeoJSON FeatureCollection for MapLibre course overlays. */
export type CourseFeatureProperties = {
	title: string;
	id: string;
	/** CSS colour for the course line (data-driven paint). */
	color: string;
	/** Race page path when the line is clickable on the homepage map. */
	href: string;
	surface: string;
	status: string;
	distanceM: number;
};

/** GeoJSON FeatureCollection for MapLibre course overlays. */
export type CourseFeatureCollection = {
	type: 'FeatureCollection';
	features: Array<{
		type: 'Feature';
		properties: CourseFeatureProperties;
		geometry: LineString;
	}>;
};


/** Extract a LineString from GeoJSON LineString / Feature / FeatureCollection payloads. */
export function lineFromCoursePayload(data: unknown): LineString | null {
	if (!data || typeof data !== 'object') return null;
	const obj = data as Record<string, unknown>;
	if (obj.type === 'LineString' && Array.isArray(obj.coordinates)) {
		return data as LineString;
	}
	if (obj.type === 'Feature') {
		const geom = (obj as { geometry?: unknown }).geometry;
		return lineFromCoursePayload(geom);
	}
	if (obj.type === 'FeatureCollection') {
		const features = (obj as CourseFeatureCollection).features;
		const first = features?.[0]?.geometry;
		return first?.type === 'LineString' ? first : null;
	}
	return null;
}

type CourseOverlayInput = {
	id: string;
	title: string;
	geojson: LineString;
	href?: string | null;
	surface?: string | null;
	status?: string | null;
	distanceM?: number | null;
	color?: string | null;
};

/**
 * Build a plain (non-Proxy) FeatureCollection for MapLibre GeoJSONSource.setData.
 * Svelte 5 reactive objects are Proxies; MapLibre often fails to render them
 * while still reading coordinates for fitBounds. Prefer JSON round-trip over
 * structuredClone — the latter throws DataCloneError on Proxies.
 */
export function courseOverlayFeatureCollection(
	races: CourseOverlayInput[],
	focus: LineString | null = null
): CourseFeatureCollection {
	const features: CourseFeatureCollection['features'] = races.map((r) => ({
		type: 'Feature',
		properties: {
			title: r.title,
			id: r.id,
			color: r.color?.trim() || colorForRaceId(r.id),
			href: r.href ?? '',
			surface: r.surface ?? '',
			status: r.status ?? '',
			distanceM: typeof r.distanceM === 'number' && Number.isFinite(r.distanceM) ? r.distanceM : 0
		},
		geometry: r.geojson
	}));
	if (focus) {
		features.push({
			type: 'Feature',
			properties: {
				title: 'Course',
				id: 'focus',
				color: '#ea580c',
				href: '',
				surface: '',
				status: '',
				distanceM: 0
			},
			geometry: focus
		});
	}
	// JSON round-trip unwraps Svelte 5 Proxies; structuredClone throws DataCloneError on them.
	return JSON.parse(JSON.stringify({ type: 'FeatureCollection', features })) as CourseFeatureCollection;
}
