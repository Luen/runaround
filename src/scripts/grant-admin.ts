import postgres from 'postgres';
import { adminEmails } from '../lib/server/identity';
import { resolvePostgresUrl } from '../lib/server/db/postgres-url';

/**
 * Grant admin out of band (#229).
 *
 * Admin is never granted from the self-asserted onboarding email, so an operator
 * promotes an existing account after the runner has signed up:
 *
 *   pnpm run grant-admin                      # every email in ADMIN_EMAILS
 *   pnpm run grant-admin -- someone@example.com
 *
 * Uses a raw client (not `$lib/server/db`) so it runs under tsx without `$app`.
 */
async function main() {
	const cliEmails = process.argv
		.slice(2)
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
	const targets = cliEmails.length > 0 ? cliEmails : adminEmails();
	if (targets.length === 0) {
		throw new Error('Pass one or more emails, or set ADMIN_EMAILS in .env');
	}

	const url = resolvePostgresUrl();
	if (!url) throw new Error('POSTGRES_URL is not set');
	const sql = postgres(url, { max: 1 });
	try {
		const rows = await sql<{ email: string }[]>`
			UPDATE "user" SET is_admin = true, updated_at = NOW()
			WHERE lower(email) = ANY(${targets})
			RETURNING email
		`;
		for (const target of targets) {
			if (!rows.some((row) => row.email.toLowerCase() === target)) {
				console.warn(`No account found for ${target} — sign in with Strava first.`);
			}
		}
		console.log(`Granted admin to ${rows.length} account(s).`);
	} finally {
		await sql.end();
	}
}

main().then(
	() => process.exit(0),
	(err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	}
);
