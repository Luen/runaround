/**
 * In-process throttle for magic-link sends from the `/login` form action.
 * better-auth's HTTP rate limit does not run on direct `auth.api.*` calls.
 */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 3;

const attempts = new Map<string, number[]>();

export function magicLinkRateLimited(ip: string, email: string, now = Date.now()): boolean {
	const key = `${ip}|${email.trim().toLowerCase()}`;
	const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
	if (recent.length >= MAX_ATTEMPTS) {
		attempts.set(key, recent);
		return true;
	}
	recent.push(now);
	attempts.set(key, recent);
	return false;
}

/** Test helper. */
export function resetMagicLinkRateLimit(): void {
	attempts.clear();
}
