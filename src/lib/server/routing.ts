import {
	buildRouteRequest,
	legCoordinates,
	parseRouteResponse,
	routingConfigFromEnv,
	type Coord
} from '../routing';

export function routingAvailable(): boolean {
	return routingConfigFromEnv() !== null;
}

/** Route one leg via the configured provider; straight line when unavailable or failing. */
export async function routeLeg(
	from: Coord,
	to: Coord
): Promise<{ coordinates: Coord[]; snapped: boolean; error?: string }> {
	const cfg = routingConfigFromEnv();
	if (!cfg) return { coordinates: [from, to], snapped: false };
	const { url, init } = buildRouteRequest(cfg, from, to);
	try {
		const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
		if (!res.ok) {
			return { coordinates: [from, to], snapped: false, error: `Routing HTTP ${res.status}` };
		}
		const routed = parseRouteResponse(cfg.provider, await res.json());
		if (!routed) return { coordinates: [from, to], snapped: false, error: 'No route found' };
		return { coordinates: legCoordinates(from, to, routed), snapped: true };
	} catch (err) {
		return {
			coordinates: [from, to],
			snapped: false,
			error: err instanceof Error ? err.message : 'Routing failed'
		};
	}
}
