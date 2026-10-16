import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, sql } from 'drizzle-orm';

vi.mock('./db', async () => {
	const { default: postgres } = await import('postgres');
	const { drizzle } = await import('drizzle-orm/postgres-js');
	const schema = await import('./db/schema');
	const configured = process.env.RUNAROUND_TEST_POSTGRES_URL;
	if (configured && !new URL(configured).pathname.endsWith('/runaround_test'))
		throw new Error('Tests require runaround_test');
	const postgresClient = postgres(configured ?? 'postgres://unused@127.0.0.1:1/runaround_test');
	return { postgresClient, db: drizzle(postgresClient, { schema }) };
});
vi.mock('$app/environment', () => ({ building: false, dev: true }));
vi.mock('../origin', () => ({ authBaseUrl: () => 'http://localhost:5173' }));
vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));
vi.mock('better-auth/svelte-kit', () => ({ sveltekitCookies: () => ({ id: 'test-cookies' }) }));
vi.mock('./email', () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }));

import { db, postgresClient } from './db';
import { account, attempts, jobs, races, user } from './db/schema';
import { sendEmail } from './email';
import { auth } from './auth';
import { load } from '../../routes/me/+page.server';

async function verifyEmail(email: string) {
	const res = await auth.handler(
		new Request('http://localhost:5173/api/auth/sign-in/magic-link', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
			body: JSON.stringify({ email, name: 'Runner', callbackURL: '/me' })
		})
	);
	expect(res.status).toBe(200);
	const message = vi.mocked(sendEmail).mock.calls.at(-1)![0];
	const url = message.text.match(/https?:\/\/\S+/)![0];
	const verified = await auth.handler(new Request(url));
	expect(verified.status).toBe(302);
	return verified;
}

describe.skipIf(!process.env.RUNAROUND_TEST_POSTGRES_URL)(
	'magic-link identity lifecycle (Postgres)',
	() => {
		beforeAll(async () => {
			vi.stubEnv('MAGIC_LINK_ENABLED', 'true');
			vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test');
			vi.stubEnv('CLOUDFLARE_API_TOKEN', 'test');
			await migrate(db, { migrationsFolder: 'drizzle' });
		});
		beforeEach(async () => {
			vi.clearAllMocks();
			await db.execute(sql`truncate table "user", races, jobs, verification cascade`);
		});
		afterAll(async () => {
			vi.unstubAllEnvs();
			await postgresClient.end();
		});
		it('does not claim athlete 123 through a strava-123 email local part', async () => {
			const [race] = await db
				.insert(races)
				.values({
					slug: 'legacy',
					title: 'Legacy',
					surface: 'road',
					startsAt: new Date('2020-01-01'),
					endsAt: new Date('2021-01-01'),
					courseGeojson: {
						type: 'LineString',
						coordinates: [
							[146, -19],
							[147, -19]
						]
					}
				})
				.returning();
			await db.insert(attempts).values({
				raceId: race.id,
				stravaAthleteId: '123',
				timeMs: 60_000,
				startedAt: new Date('2020-06-01'),
				matchMethod: 'import',
				source: 'strava_import'
			});
			await verifyEmail('strava-123@example.test');
			const [runner] = await db.select().from(user);
			expect(runner.stravaAthleteId).toBeNull();
			expect(runner.needsEmail).toBe(false);
			expect(runner.emailVerified).toBe(true);
			expect((await db.select().from(attempts))[0].userId).toBeNull();
			expect(await db.select().from(jobs)).toHaveLength(0);
		});
		it('offers a secure reconnect after verification removes old unproven OAuth links', async () => {
			await db.insert(user).values({
				id: 'existing',
				name: 'Existing',
				email: 'existing@example.test',
				emailVerified: false,
				needsEmail: false,
				stravaAthleteId: '123'
			});
			await db.insert(account).values({
				id: 'old',
				userId: 'existing',
				issuer: 'local:oauth:strava',
				providerId: 'strava',
				accountId: '123',
				accessToken: 'old-token'
			});
			await verifyEmail('existing@example.test');
			const [runner] = await db.select().from(user).where(eq(user.id, 'existing'));
			expect(await db.select().from(account)).toHaveLength(0);
			const data = await load({ locals: { user: runner } } as never);
			expect(data).toMatchObject({ hasStrava: false, stravaNeedsReconnect: true });
			// Simulate the authenticated provider callback writing its verified account binding.
			const ctx = await auth.$context;
			await ctx.internalAdapter.createAccount({
				userId: runner.id,
				issuer: 'local:oauth:strava',
				providerId: 'strava',
				accountId: '123',
				accessToken: 'new-token'
			});
			expect(await load({ locals: { user: runner } } as never)).toMatchObject({
				hasStrava: true,
				stravaNeedsReconnect: false
			});
			expect(await db.select().from(jobs)).toHaveLength(1);
		});
	}
);
