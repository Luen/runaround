import { db } from './db';
import { account, activities } from './db/schema';
import { and, eq } from 'drizzle-orm';
import { findSameRun, withActivityIngestion } from './activity-ingestion';
import {
	GARMIN_REGISTRATION_URL,
	GARMIN_TOKEN_URL,
	GARMIN_USER_ID_URL,
	garminActivityKey,
	parseGarminActivity,
	type GarminActivityDetail
} from '../garmin';
import { matchActivityToRaces } from './sync';

export const GARMIN_PROVIDER = 'garmin';
const GARMIN_ISSUER = 'local:oauth:garmin';

type TokenResponse = {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	refresh_token_expires_in?: number;
	scope?: string;
};

/** Exchange the PKCE authorization code and link the Garmin user to `userId`. */
export async function connectGarmin(opts: {
	userId: string;
	code: string;
	verifier: string;
	redirectUri: string;
}): Promise<void> {
	const res = await fetch(GARMIN_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code: opts.code,
			code_verifier: opts.verifier,
			redirect_uri: opts.redirectUri,
			client_id: process.env.GARMIN_CLIENT_ID ?? '',
			client_secret: process.env.GARMIN_CLIENT_SECRET ?? ''
		})
	});
	if (!res.ok) throw new Error(`Garmin token exchange failed (${res.status})`);
	const tokens = (await res.json()) as TokenResponse;

	const idRes = await fetch(GARMIN_USER_ID_URL, {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});
	if (!idRes.ok) throw new Error(`Garmin user id lookup failed (${idRes.status})`);
	const { userId: garminUserId } = (await idRes.json()) as { userId: string };
	if (!garminUserId) throw new Error('Garmin did not return a user id');

	const now = Date.now();
	const values = {
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token ?? null,
		accessTokenExpiresAt: tokens.expires_in ? new Date(now + tokens.expires_in * 1000) : null,
		refreshTokenExpiresAt: tokens.refresh_token_expires_in
			? new Date(now + tokens.refresh_token_expires_in * 1000)
			: null,
		scope: tokens.scope ?? null,
		updatedAt: new Date()
	};
	const [existing] = await db
		.select()
		.from(account)
		.where(and(eq(account.issuer, GARMIN_ISSUER), eq(account.accountId, garminUserId)))
		.limit(1);
	if (existing && existing.userId !== opts.userId) {
		throw new Error('That Garmin account is already connected to another RunAround runner');
	}
	if (existing) {
		await db.update(account).set(values).where(eq(account.id, existing.id));
	} else {
		await db.insert(account).values({
			id: crypto.randomUUID(),
			accountId: garminUserId,
			providerId: GARMIN_PROVIDER,
			issuer: GARMIN_ISSUER,
			userId: opts.userId,
			...values
		});
	}
}

export async function garminAccountFor(userId: string) {
	const [row] = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, GARMIN_PROVIDER)))
		.limit(1);
	return row ?? null;
}

/** Disconnect: tell Garmin (best effort) and forget the tokens. */
export async function disconnectGarmin(userId: string): Promise<void> {
	const row = await garminAccountFor(userId);
	if (!row) return;
	if (row.accessToken) {
		await fetch(GARMIN_REGISTRATION_URL, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${row.accessToken}` }
		}).catch(() => undefined);
	}
	await db.delete(account).where(eq(account.id, row.id));
}

/** Garmin told us the user revoked access. */
export async function forgetGarminUser(garminUserId: string): Promise<void> {
	await db
		.delete(account)
		.where(and(eq(account.issuer, GARMIN_ISSUER), eq(account.accountId, garminUserId)));
}

/** Worker: store one pushed Garmin activity and match it. Returns why it was skipped, if it was. */
export async function ingestGarminActivity(detail: GarminActivityDetail): Promise<string | null> {
	const key = garminActivityKey(detail);
	if (!detail.userId || !key) return 'missing ids';
	const [link] = await db
		.select()
		.from(account)
		.where(and(eq(account.issuer, GARMIN_ISSUER), eq(account.accountId, detail.userId)))
		.limit(1);
	if (!link) return 'unknown garmin user';
	const parsed = parseGarminActivity(detail);
	if (!parsed) return 'not a GPS run/walk/hike';

	return withActivityIngestion(link.userId, async (database) => {
		const [existing] = await database
			.select()
			.from(activities)
			.where(eq(activities.garminActivityId, key))
			.limit(1);
		if (existing && existing.userId !== link.userId) return 'activity belongs to another runner';
		// An exact provider id is resumable, not a duplicate from another source.
		if (!existing && (await findSameRun(database, link.userId, parsed.startedAt)))
			return 'same run already synced';

		const [row] = existing
			? [existing]
			: await database
					.insert(activities)
					.values({
						userId: link.userId,
						source: 'garmin',
						garminActivityId: key,
						sport: 'Run',
						name: parsed.name,
						startedAt: parsed.startedAt,
						distanceM: parsed.distanceM,
						movingTimeS: parsed.elapsedS,
						elapsedTimeS: parsed.elapsedS,
						streamFetchedAt: new Date()
					})
					.onConflictDoNothing()
					.returning();
		if (!row) return 'already stored';
		await matchActivityToRaces(link.userId, row, parsed.timed, true, undefined, database);
		return null;
	});
}
