/**
 * Resolve the Postgres connection URL from Supabase/Vercel-style env vars.
 * Prefer pooled `POSTGRES_URL`, then direct `POSTGRES_URL_NON_POOLING` (migrations).
 */
export function resolvePostgresUrl(): string | undefined {
	const pooled = process.env['POSTGRES_URL']?.trim();
	if (pooled) return pooled;

	const direct = process.env['POSTGRES_URL_NON_POOLING']?.trim();
	if (direct) return direct;

	return undefined;
}
