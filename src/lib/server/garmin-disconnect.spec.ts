import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';

// Never read the app's POSTGRES_URL or .env in database tests.
vi.mock('./db', async () => {
	const { default: postgres } = await import('postgres');
	const { drizzle } = await import('drizzle-orm/postgres-js');
	const schema = await import('./db/schema');
	const configured = process.env.RUNAROUND_TEST_POSTGRES_URL;
	if (configured && !new URL(configured).pathname.endsWith('/runaround_test')) {
		throw new Error('Integration tests require a dedicated runaround_test database');
	}
	const postgresClient = postgres(configured ?? 'postgres://unused@127.0.0.1:1/runaround_test');
	return { postgresClient, db: drizzle(postgresClient, { schema }) };
});

import { db, postgresClient } from './db';
import { account, user } from './db/schema';
import { disconnectGarmin, freshGarminAccessToken, garminAccountFor } from './garmin';
import { GARMIN_REGISTRATION_URL, GARMIN_TOKEN_URL } from '../garmin';

const fetchMock = vi.fn<typeof fetch>();

async function linkGarmin(expiresAt: Date) {
	await db.insert(account).values({
		id: 'garmin-link',
		userId: 'runner',
		providerId: 'garmin',
		issuer: 'local:oauth:garmin',
		accountId: 'garmin-user',
		accessToken: 'stale-token',
		refreshToken: 'refresh-token',
		accessTokenExpiresAt: expiresAt
	});
}

function authHeader(call: Parameters<typeof fetch>) {
	return new Headers(call[1]?.headers).get('Authorization');
}

describe.skipIf(!process.env.RUNAROUND_TEST_POSTGRES_URL)('Garmin disconnect (Postgres)', () => {
	beforeAll(async () => {
		await migrate(db, { migrationsFolder: 'drizzle' });
	});
	beforeEach(async () => {
		await db.execute(sql`truncate table "user" cascade`);
		await db
			.insert(user)
			.values({ id: 'runner', name: 'Runner', email: 'runner@example.test', needsEmail: false });
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});
	afterAll(async () => {
		await postgresClient.end();
	});

	it('refreshes an expired access token before deregistering (#241)', async () => {
		await linkGarmin(new Date(Date.now() - 60_000));
		fetchMock
			.mockResolvedValueOnce(Response.json({ access_token: 'fresh-token', expires_in: 86_400 }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));

		await disconnectGarmin('runner');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [refresh, deregister] = fetchMock.mock.calls;
		expect(refresh[0]).toBe(GARMIN_TOKEN_URL);
		expect(String(refresh[1]?.body)).toContain('grant_type=refresh_token');
		expect(String(refresh[1]?.body)).toContain('refresh_token=refresh-token');
		expect(deregister[0]).toBe(GARMIN_REGISTRATION_URL);
		expect(authHeader(deregister)).toBe('Bearer fresh-token');
		expect(await db.select().from(account)).toHaveLength(0);
	});

	it('uses a still-valid token without refreshing', async () => {
		await linkGarmin(new Date(Date.now() + 3_600_000));
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

		await disconnectGarmin('runner');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(authHeader(fetchMock.mock.calls[0])).toBe('Bearer stale-token');
	});

	it('still removes the link, and logs, when Garmin rejects or is unreachable', async () => {
		await linkGarmin(new Date(Date.now() - 60_000));
		fetchMock
			.mockResolvedValueOnce(new Response(null, { status: 400 }))
			.mockRejectedValueOnce(new Error('network down'));

		await disconnectGarmin('runner');

		expect(console.warn).toHaveBeenCalled();
		expect(await db.select().from(account)).toHaveLength(0);
	});

	it('bounds every Garmin call with a timeout and still unlinks on timeout (#243)', async () => {
		await linkGarmin(new Date(Date.now() - 60_000));
		fetchMock
			.mockResolvedValueOnce(Response.json({ access_token: 'fresh-token', expires_in: 86_400 }))
			.mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'));

		await disconnectGarmin('runner');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		for (const call of fetchMock.mock.calls) {
			expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
		}
		expect(console.warn).toHaveBeenCalled();
		expect(await db.select().from(account)).toHaveLength(0);
	});

	it('saves a refreshed token only when asked to persist (#244)', async () => {
		await linkGarmin(new Date(Date.now() - 60_000));
		const row = (await garminAccountFor('runner'))!;
		fetchMock.mockImplementation(async () =>
			Response.json({ access_token: 'fresh-token', expires_in: 86_400 })
		);

		expect(await freshGarminAccessToken(row, { persist: false })).toBe('fresh-token');
		expect((await garminAccountFor('runner'))?.accessToken).toBe('stale-token');

		expect(await freshGarminAccessToken(row)).toBe('fresh-token');
		const saved = await garminAccountFor('runner');
		expect(saved?.accessToken).toBe('fresh-token');
		expect(saved?.refreshToken).toBe('refresh-token');
	});
});
