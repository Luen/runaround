/**
 * Course drawing (#209): pure helpers for snap-to-path routing providers and
 * for turning drawn legs into the same LineString/GPX course an upload makes.
 * The server proxies provider calls (`src/lib/server/routing.ts`) so API keys
 * never reach the browser.
 */
import { haversineMeters } from './geo';

export type Coord = [number, number]; // [lng, lat]
export type RoutingProvider = 'ors' | 'graphhopper' | 'osrm';

export type RoutingConfig = {
	provider: RoutingProvider;
	/** ORS / GraphHopper API key; OSRM usually self-hosted without one. */
	apiKey: string | null;
	/** Base URL override (required for OSRM). */
	baseUrl: string | null;
	/** Provider profile, e.g. ORS `foot-hiking`, GraphHopper `hike`/`foot`, OSRM `foot`. */
	profile: string;
};

const DEFAULT_PROFILE: Record<RoutingProvider, string> = {
	ors: 'foot-hiking',
	graphhopper: 'foot',
	osrm: 'foot'
};

const DEFAULT_BASE: Record<RoutingProvider, string | null> = {
	ors: 'https://api.openrouteservice.org',
	graphhopper: 'https://graphhopper.com/api/1',
	osrm: null
};

/** Read routing env; null = snapping unavailable (straight lines only). */
export function routingConfigFromEnv(
	env: Record<string, string | undefined> = process.env
): RoutingConfig | null {
	const provider = env.ROUTING_PROVIDER?.trim().toLowerCase();
	if (provider !== 'ors' && provider !== 'graphhopper' && provider !== 'osrm') return null;
	const apiKey = env.ROUTING_API_KEY?.trim() || null;
	const baseUrl =
		(env.ROUTING_BASE_URL?.trim() || DEFAULT_BASE[provider])?.replace(/\/+$/, '') ?? null;
	if (provider !== 'osrm' && !apiKey) return null;
	if (!baseUrl) return null;
	return {
		provider,
		apiKey,
		baseUrl,
		profile: env.ROUTING_PROFILE?.trim() || DEFAULT_PROFILE[provider]
	};
}

export type ProviderRequest = { url: string; init: RequestInit };

/** Build the HTTP request for one leg `from` → `to`. */
export function buildRouteRequest(cfg: RoutingConfig, from: Coord, to: Coord): ProviderRequest {
	if (cfg.provider === 'ors') {
		return {
			url: `${cfg.baseUrl}/v2/directions/${encodeURIComponent(cfg.profile)}/geojson`,
			init: {
				method: 'POST',
				headers: {
					Authorization: cfg.apiKey ?? '',
					'Content-Type': 'application/json',
					Accept: 'application/geo+json, application/json'
				},
				body: JSON.stringify({ coordinates: [from, to], elevation: false })
			}
		};
	}
	if (cfg.provider === 'graphhopper') {
		const params = new URLSearchParams({
			profile: cfg.profile,
			points_encoded: 'false',
			instructions: 'false',
			key: cfg.apiKey ?? ''
		});
		params.append('point', `${from[1]},${from[0]}`);
		params.append('point', `${to[1]},${to[0]}`);
		return { url: `${cfg.baseUrl}/route?${params}`, init: { method: 'GET' } };
	}
	const path = `${from[0]},${from[1]};${to[0]},${to[1]}`;
	return {
		url: `${cfg.baseUrl}/route/v1/${encodeURIComponent(cfg.profile)}/${path}?overview=full&geometries=geojson`,
		init: { method: 'GET' }
	};
}

function validCoords(value: unknown): Coord[] | null {
	if (!Array.isArray(value)) return null;
	const out: Coord[] = [];
	for (const c of value) {
		if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') return null;
		out.push([c[0], c[1]]);
	}
	return out.length >= 2 ? out : null;
}

/** Extract [lng,lat] coordinates from a provider response body. */
export function parseRouteResponse(provider: RoutingProvider, body: unknown): Coord[] | null {
	const b = body as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
	if (!b) return null;
	if (provider === 'ors') return validCoords(b.features?.[0]?.geometry?.coordinates);
	if (provider === 'graphhopper') return validCoords(b.paths?.[0]?.points?.coordinates);
	return validCoords(b.routes?.[0]?.geometry?.coordinates);
}

/** Leg geometry: routed points when available, straight line otherwise. Endpoints pinned to the waypoints. */
export function legCoordinates(from: Coord, to: Coord, routed: Coord[] | null): Coord[] {
	if (!routed || routed.length < 2) return [from, to];
	return [from, ...routed.slice(1, -1).map((c) => [c[0], c[1]] as Coord), to];
}

/** Join consecutive legs into one LineString, dropping the duplicated joint points. */
export function joinLegs(legs: Coord[][]): Coord[] {
	const out: Coord[] = [];
	for (const leg of legs) {
		for (const c of leg) {
			const last = out[out.length - 1];
			if (last && last[0] === c[0] && last[1] === c[1]) continue;
			out.push([Number(c[0].toFixed(6)), Number(c[1].toFixed(6))]);
		}
	}
	return out;
}

export function lineDistanceM(coords: Coord[]): number {
	let d = 0;
	for (let i = 1; i < coords.length; i += 1) {
		d += haversineMeters(
			{ lng: coords[i - 1][0], lat: coords[i - 1][1] },
			{ lng: coords[i][0], lat: coords[i][1] }
		);
	}
	return d;
}

/** Validate a drawn course posted by the admin form. */
export function parseDrawnCourse(
	raw: unknown
): { type: 'LineString'; coordinates: Coord[] } | null {
	let value = raw;
	if (typeof raw === 'string') {
		if (!raw.trim()) return null;
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	const v = value as { type?: string; coordinates?: unknown } | null;
	if (v?.type !== 'LineString') return null;
	const coords = validCoords(v.coordinates);
	if (!coords || coords.length > 50_000) return null;
	if (coords.some(([lng, lat]) => Math.abs(lng) > 180 || Math.abs(lat) > 90)) return null;
	if (lineDistanceM(coords) < 50) return null;
	return { type: 'LineString', coordinates: coords };
}
