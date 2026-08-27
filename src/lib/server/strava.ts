import { db } from './db';
import { account, user } from './db/schema';
import { and, eq } from 'drizzle-orm';

const STRAVA = 'https://www.strava.com/api/v3';

export type StravaActivity = {
	id: number;
	name: string;
	type: string;
	sport_type?: string;
	start_date: string;
	distance: number;
	moving_time: number;
	elapsed_time: number;
	map?: { summary_polyline?: string };
	segment_efforts?: { segment?: { id: number }; elapsed_time: number; start_date: string }[];
};

export type StravaStreams = {
	latlng?: { data: [number, number][] };
	time?: { data: number[] };
};

async function refreshIfNeeded(userId: string): Promise<string | null> {
	const [row] = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'strava')))
		.limit(1);
	if (!row?.refreshToken) return row?.accessToken ?? null;

	const expires = row.accessTokenExpiresAt?.getTime() ?? 0;
	if (row.accessToken && expires > Date.now() + 60_000) {
		return row.accessToken;
	}

	const body = new URLSearchParams({
		client_id: process.env.STRAVA_CLIENT_ID ?? '',
		client_secret: process.env.STRAVA_CLIENT_SECRET ?? '',
		grant_type: 'refresh_token',
		refresh_token: row.refreshToken
	});
	const res = await fetch('https://www.strava.com/oauth/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) return row.accessToken;
	const json = (await res.json()) as {
		access_token: string;
		refresh_token: string;
		expires_at: number;
	};
	await db
		.update(account)
		.set({
			accessToken: json.access_token,
			refreshToken: json.refresh_token,
			accessTokenExpiresAt: new Date(json.expires_at * 1000),
			updatedAt: new Date()
		})
		.where(eq(account.id, row.id));
	return json.access_token;
}

export async function stravaFetch<T>(userId: string, path: string): Promise<T | null> {
	const token = await refreshIfNeeded(userId);
	if (!token) return null;
	const res = await fetch(`${STRAVA}${path}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (res.status === 429) {
		throw new Error('STRAVA_RATE_LIMIT');
	}
	if (!res.ok) return null;
	return (await res.json()) as T;
}

export async function listActivities(
	userId: string,
	page = 1,
	perPage = 50
): Promise<StravaActivity[]> {
	const data = await stravaFetch<StravaActivity[]>(
		userId,
		`/athlete/activities?page=${page}&per_page=${perPage}`
	);
	return data ?? [];
}

export async function getActivity(userId: string, activityId: string): Promise<StravaActivity | null> {
	return stravaFetch<StravaActivity>(userId, `/activities/${activityId}?include_all_efforts=true`);
}

export async function getActivityStreams(
	userId: string,
	activityId: string
): Promise<StravaStreams | null> {
	return stravaFetch<StravaStreams>(
		userId,
		`/activities/${activityId}/streams?keys=latlng,time&key_by_type=true`
	);
}

export async function stravaUsers() {
	return db.select({ id: user.id }).from(user);
}
