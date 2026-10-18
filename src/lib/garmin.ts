/**
 * Garmin Connect (#107): pure helpers for OAuth 2.0 PKCE and Activity Details
 * push payloads. Server/DB code lives in `src/lib/server/garmin.ts`.
 */
import { haversineMeters } from './geo';
import type { ParsedActivity } from './activity-file';

export const GARMIN_AUTHORIZE_URL = 'https://connect.garmin.com/oauth2Confirm';
export const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
export const GARMIN_USER_ID_URL = 'https://apis.garmin.com/wellness-api/rest/user/id';
export const GARMIN_REGISTRATION_URL =
	'https://apis.garmin.com/wellness-api/rest/user/registration';

export function garminEnabled(env: Record<string, string | undefined> = process.env): boolean {
	return (
		env.GARMIN_ENABLED?.trim().toLowerCase() === 'true' &&
		Boolean(env.GARMIN_CLIENT_ID?.trim()) &&
		Boolean(env.GARMIN_CLIENT_SECRET?.trim()) &&
		Boolean(env.GARMIN_WEBHOOK_SECRET?.trim())
	);
}

function base64Url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function randomToken(bytes = 32): string {
	return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** RFC 7636 S256 code challenge. */
export async function pkceChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return base64Url(new Uint8Array(digest));
}

export function garminAuthorizeUrl(opts: {
	clientId: string;
	redirectUri: string;
	state: string;
	codeChallenge: string;
}): string {
	const params = new URLSearchParams({
		client_id: opts.clientId,
		response_type: 'code',
		redirect_uri: opts.redirectUri,
		state: opts.state,
		code_challenge: opts.codeChallenge,
		code_challenge_method: 'S256'
	});
	return `${GARMIN_AUTHORIZE_URL}?${params}`;
}

/** Shape of one item in a Garmin Activity Details push (`activityDetails[]`). */
export type GarminActivityDetail = {
	userId?: string;
	summaryId?: string;
	activityId?: number | string;
	summary?: {
		activityName?: string;
		activityType?: string;
		startTimeInSeconds?: number;
		durationInSeconds?: number;
		distanceInMeters?: number;
	};
	samples?: {
		startTimeInSeconds?: number;
		latitudeInDegree?: number;
		longitudeInDegree?: number;
	}[];
};

const FOOT_TYPES = /RUN|WALK|HIK/i;

export function isFootActivity(type: string | undefined): boolean {
	return Boolean(type && FOOT_TYPES.test(type) && !/TREADMILL|INDOOR|VIRTUAL/i.test(type));
}

/** Convert a Garmin activity detail into the shared ParsedActivity shape, or null if unusable. */
export function parseGarminActivity(detail: GarminActivityDetail): ParsedActivity | null {
	const summary = detail.summary ?? {};
	if (!isFootActivity(summary.activityType)) return null;
	const pts = (detail.samples ?? [])
		.filter(
			(s) =>
				typeof s.startTimeInSeconds === 'number' &&
				typeof s.latitudeInDegree === 'number' &&
				typeof s.longitudeInDegree === 'number'
		)
		.map((s) => ({
			sec: s.startTimeInSeconds as number,
			point: { lat: s.latitudeInDegree as number, lng: s.longitudeInDegree as number }
		}))
		.sort((a, b) => a.sec - b.sec);
	if (pts.length < 2 || pts[pts.length - 1].sec <= pts[0].sec) return null;

	const start = summary.startTimeInSeconds ?? pts[0].sec;
	let distanceM = 0;
	for (let i = 1; i < pts.length; i += 1)
		distanceM += haversineMeters(pts[i - 1].point, pts[i].point);
	return {
		name: summary.activityName?.trim() || 'Garmin activity',
		startedAt: new Date(start * 1000),
		elapsedS: summary.durationInSeconds ?? pts[pts.length - 1].sec - start,
		distanceM: summary.distanceInMeters ?? distanceM,
		timed: pts.map((p) => ({ point: p.point, t: p.sec - start }))
	};
}

/** Garmin activity id used for de-duplication. */
export function garminActivityKey(detail: GarminActivityDetail): string | null {
	const id = detail.activityId ?? detail.summaryId;
	return id === undefined || id === null || id === '' ? null : String(id);
}
