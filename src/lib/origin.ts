/**
 * Pick a usable absolute site origin. `ORIGIN` may be unset, empty ("") or
 * missing its scheme in some environments (it is "" on Vercel production), so
 * validate it and fall back instead of letting `new URL(path, origin)` throw.
 */
export function siteOrigin(configured: string | null | undefined, fallback: string): string {
	for (const candidate of [configured, fallback]) {
		const value = candidate?.trim();
		if (!value) continue;
		try {
			const url = new URL(value);
			if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
		} catch {
			// try the next candidate
		}
	}
	return fallback;
}

/** better-auth baseURL: first valid http(s) origin, else localhost in dev, else undefined (infer from request). */
export function authBaseUrl(
	origin: string | null | undefined,
	betterAuthUrl: string | null | undefined,
	isDev: boolean
): string | undefined {
	const fallback = isDev ? 'http://localhost:5173' : '';
	const picked = siteOrigin(origin, siteOrigin(betterAuthUrl, fallback));
	return picked || undefined;
}
