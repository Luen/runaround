import { haversineMeters, type CourseFeatureCollection } from '$lib/geo';

/** Start and finish closer than this are a loop (one combined marker). GPS/Strava loops often end 50–100 m from the start. */
export const LOOP_THRESHOLD_M = 150;

export type RouteEndpointKind = 'start' | 'finish' | 'start-finish';

export type RouteEndpointCollection = {
	type: 'FeatureCollection';
	features: Array<{
		type: 'Feature';
		properties: { kind: RouteEndpointKind; id: string; title: string };
		geometry: { type: 'Point'; coordinates: [number, number] };
	}>;
};

function validCoord(c: unknown): c is [number, number] {
	return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
}

/** True when a route's first and last points are within `thresholdM` metres. */
export function isLoop(coordinates: [number, number][], thresholdM = LOOP_THRESHOLD_M): boolean {
	const pts = coordinates.filter(validCoord);
	if (pts.length < 2) return false;
	const [aLng, aLat] = pts[0];
	const [bLng, bLat] = pts[pts.length - 1];
	return haversineMeters({ lng: aLng, lat: aLat }, { lng: bLng, lat: bLat }) <= thresholdM;
}

/** Start/finish (or combined start-finish for loops) point features for each course line. */
export function routeEndpointFeatures(
	collection: CourseFeatureCollection,
	thresholdM = LOOP_THRESHOLD_M
): RouteEndpointCollection {
	const features: RouteEndpointCollection['features'] = [];
	for (const f of collection.features) {
		const pts = (f.geometry?.coordinates ?? []).filter(validCoord);
		if (pts.length < 2) continue;
		const id = String(f.properties?.id ?? '');
		const title = String(f.properties?.title ?? '');
		const start: [number, number] = [pts[0][0], pts[0][1]];
		const end = pts[pts.length - 1];
		if (isLoop(pts, thresholdM)) {
			features.push({
				type: 'Feature',
				properties: { kind: 'start-finish', id, title },
				geometry: { type: 'Point', coordinates: start }
			});
			continue;
		}
		// Finish first so the start marker draws on top if they ever overlap.
		features.push({
			type: 'Feature',
			properties: { kind: 'finish', id, title },
			geometry: { type: 'Point', coordinates: [end[0], end[1]] }
		});
		features.push({
			type: 'Feature',
			properties: { kind: 'start', id, title },
			geometry: { type: 'Point', coordinates: start }
		});
	}
	return { type: 'FeatureCollection', features };
}
