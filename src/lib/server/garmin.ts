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

/** Upper bound for any Garmin API call, so connect/disconnect cannot hang (#243). */
export const GARMIN_TIMEOUT_MS = 10_000;

function garminFetch(url: string, init: RequestInit): Promise<Response> {
	return fetch(url, { ...init, signal: AbortSignal.timeout(GARMIN_TIMEOUT_MS) });
}

/** Account columns for a Garmin token response (authorization code or refresh). */
function tokenColumns(tokens: TokenResponse, now = Date.now()) {
	return {
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token ?? null,
		accessTokenExpiresAt: tokens.expires_in ? new Date(now + tokens.expires_in * 1000) : null,
		refreshTokenExpiresAt: tokens.refresh_token_expires_in
			? new Date(now + tokens.refresh_token_expires_in * 1000)
			: null,
		scope: tokens.scope ?? null,
		updatedAt: new Date(now)
	};
}

/** Exchange the PKCE authorization code and link the Garmin user to `userId`. */
export async function connectGarmin(opts: {
	userId: string;
	code: string;
	verifier: string;
	redirectUri: string;
}): Promise<void> {
	const res = await garminFetch(GARMIN_TOKEN_URL, {
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

	const idRes = await garminFetch(GARMIN_USER_ID_URL, {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});
	if (!idRes.ok) throw new Error(`Garmin user id lookup failed (${idRes.status})`);
	const { userId: garminUserId } = (await idRes.json()) as { userId: string };
	if (!garminUserId) throw new Error('Garmin did not return a user id');

	const values = tokenColumns(tokens);
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

type GarminAccountRow = NonNullable<Awaited<ReturnType<typeof garminAccountFor>>>;

/**
 * A usable access token for `row`, refreshing it first when it has expired or
 * expires within a minute (#241). Garmin access tokens last about 24 h and the
 * push model never needs them after connecting, so the stored one is usually stale
 * by the time a runner disconnects. Returns the stored token if refresh fails.
 * Pass `persist: false` when the account is about to be deleted (#244).
 */
export async function freshGarminAccessToken(
	row: GarminAccountRow,
	{ persist = true }: { persist?: boolean } = {}
): Promise<string | null> {
	const now = Date.now();
	const expiresAt = row.accessTokenExpiresAt?.getTime();
	if (row.accessToken && (expiresAt === undefined || expiresAt > now + 60_000)) {
		return row.accessToken;
	}
	const refreshUsable =
		row.refreshToken && (!row.refreshTokenExpiresAt || row.refreshTokenExpiresAt.getTime() > now);
	if (!refreshUsable) return row.accessToken ?? null;
	const res = await garminFetch(GARMIN_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: row.refreshToken as string,
			client_id: process.env.GARMIN_CLIENT_ID ?? '',
			client_secret: process.env.GARMIN_CLIENT_SECRET ?? ''
		})
	});
	if (!res.ok) {
		console.warn(`Garmin token refresh failed (${res.status})`);
		return row.accessToken ?? null;
	}
	const tokens = (await res.json()) as TokenResponse;
	if (!persist) return tokens.access_token;
	// Garmin may rotate the refresh token; keep the old one if it does not send a new one.
	const values = { ...tokenColumns(tokens, now) };
	if (!tokens.refresh_token) {
		values.refreshToken = row.refreshToken;
		values.refreshTokenExpiresAt = row.refreshTokenExpiresAt;
	}
	await db.update(account).set(values).where(eq(account.id, row.id));
	return tokens.access_token;
}

/**
 * Disconnect: deregister with Garmin so it stops pushing this runner's activities,
 * then forget the tokens. The local link is removed even if Garmin is unreachable,
 * but a failed deregistration is logged rather than hidden (#241).
 */
export async function disconnectGarmin(userId: string): Promise<void> {
	const row = await garminAccountFor(userId);
	if (!row) return;
	try {
		// The row is deleted below, so don't save the refreshed token (#244).
		const token = await freshGarminAccessToken(row, { persist: false });
		if (token) {
			const res = await garminFetch(GARMIN_REGISTRATION_URL, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) console.warn(`Garmin deregistration failed (${res.status})`);
		}
	} catch (err) {
		console.warn('Garmin deregistration failed', err);
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
