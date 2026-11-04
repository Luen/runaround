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
vi.mock('$app/env', () => ({ building: false, dev: true }));
vi.mock('../origin', () => ({ authBaseUrl: () => 'http://localhost:5173' }));
vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));
vi.mock('better-auth/svelte-kit', () => ({ sveltekitCookies: () => ({ id: 'test-cookies' }) }));
vi.mock('./email', () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }));

import { db, postgresClient } from './db';
import { account, attempts, newsletterPendingOptIns, jobs, races, user } from './db/schema';
import { sendEmail } from './email';
import { auth } from './auth';
import { load } from '../../routes/me/+page.server';

async function verifyEmail(email: string, callbackURL = '/me') {
	const res = await auth.handler(
		new Request('http://localhost:5173/api/auth/sign-in/magic-link', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
			body: JSON.stringify({ email, name: 'Runner', callbackURL })
		})
	);
	expect(res.status).toBe(200);
	const message = vi.mocked(sendEmail).mock.calls.at(-1)![0];
	const url = message.text.match(/https?:\/\/\S+/)![0];
	const verified = await auth.handler(new Request(url));
	expect(verified.status).toBe(302);
	return verified;
}

function meLoad(runner: { id: string } & Record<string, unknown>, path = '/me') {
	return load({
		locals: { user: runner },
		url: new URL(path, 'http://localhost:5173')
	} as never);
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
			await db.execute(
				sql`truncate table "user", races, jobs, verification, newsletter_pending_opt_ins cascade`
			);
		});
		afterAll(async () => {
			vi.unstubAllEnvs();
			await postgresClient.end();
		});
		it('applies newsletter consent from the magic-link callback (#168)', async () => {
			await verifyEmail('new@example.test', '/me?newsletter=1');
			const [runner] = await db.select().from(user);
			await meLoad(runner, '/me?newsletter=1');
			const [updated] = await db.select().from(user).where(eq(user.id, runner.id));
			expect(updated.newsletterOptIn).toBe(true);
			expect(updated.newsletterOptInAt).not.toBeNull();
		});

		it('does not subscribe from a pending email alone', async () => {
			await db.insert(newsletterPendingOptIns).values({ email: 'new@example.test' });
			await verifyEmail('new@example.test', '/me');
			const [runner] = await db.select().from(user);
			await meLoad(runner, '/me');
			expect(runner.newsletterOptIn).toBe(false);
			expect(await db.select().from(newsletterPendingOptIns)).toHaveLength(1);
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
			const data = await meLoad(runner);
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
			expect(await meLoad(runner)).toMatchObject({
				hasStrava: true,
				stravaNeedsReconnect: false
			});
			expect(await db.select().from(jobs)).toHaveLength(1);
		});
		it('moves an athlete id orphaned by email-proof cleanup to the new Strava login', async () => {
			await db.insert(user).values([
				{
					id: 'old',
					name: 'Old',
					email: 'old@example.test',
					needsEmail: false,
					stravaAthleteId: '123'
				},
				{
					id: 'fresh',
					name: 'Fresh',
					email: 'strava-123@users.runaround.invalid',
					needsEmail: true
				}
			]);
			const ctx = await auth.$context;
			await ctx.internalAdapter.createAccount({
				userId: 'fresh',
				issuer: 'local:oauth:strava',
				providerId: 'strava',
				accountId: '123',
				accessToken: 'token'
			});
			const rows = await db.select().from(user);
			expect(rows.find((r) => r.id === 'fresh')?.stravaAthleteId).toBe('123');
			expect(rows.find((r) => r.id === 'old')?.stravaAthleteId).toBeNull();
		});
	}
);
