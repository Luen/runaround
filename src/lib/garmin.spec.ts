import { describe, expect, it } from 'vitest';
import {
	garminActivityKey,
	garminAuthorizeUrl,
	garminEnabled,
	isFootActivity,
	parseGarminActivity,
	pkceChallenge
} from './garmin';

describe('garminEnabled', () => {
	const full = {
		GARMIN_ENABLED: 'true',
		GARMIN_CLIENT_ID: 'id',
		GARMIN_CLIENT_SECRET: 'secret',
		GARMIN_WEBHOOK_SECRET: 'hook'
	};
	it('requires the flag and all credentials', () => {
		expect(garminEnabled({})).toBe(false);
		expect(garminEnabled({ ...full, GARMIN_ENABLED: 'false' })).toBe(false);
		expect(garminEnabled({ ...full, GARMIN_WEBHOOK_SECRET: '' })).toBe(false);
		expect(garminEnabled(full)).toBe(true);
	});
});

describe('PKCE', () => {
	it('matches the RFC 7636 example', async () => {
		expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
		);
	});
	it('builds the authorize URL', () => {
		const url = new URL(
			garminAuthorizeUrl({
				clientId: 'c',
				redirectUri: 'https://x/cb',
				state: 's',
				codeChallenge: 'ch'
			})
		);
		expect(url.origin + url.pathname).toBe('https://connect.garmin.com/oauth2Confirm');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('redirect_uri')).toBe('https://x/cb');
	});
});

describe('parseGarminActivity', () => {
	const start = Date.parse('2027-03-06T21:00:00Z') / 1000;
	const detail = {
		userId: 'g1',
		activityId: 123,
		summary: {
			activityName: 'Townsville Trail Running',
			activityType: 'TRAIL_RUNNING',
			startTimeInSeconds: start,
			durationInSeconds: 120,
			distanceInMeters: 400
		},
		samples: [
			{ startTimeInSeconds: start + 60, latitudeInDegree: -19.301, longitudeInDegree: 146.75 },
			{ startTimeInSeconds: start, latitudeInDegree: -19.3, longitudeInDegree: 146.75 },
			{ startTimeInSeconds: start + 30 },
			{ startTimeInSeconds: start + 120, latitudeInDegree: -19.302, longitudeInDegree: 146.75 }
		]
	};

	it('converts samples with positions into timed points', () => {
		const a = parseGarminActivity(detail);
		expect(a?.name).toBe('Townsville Trail Running');
		expect(a?.startedAt.toISOString()).toBe('2027-03-06T21:00:00.000Z');
		expect(a?.timed.map((p) => p.t)).toEqual([0, 60, 120]);
		expect(a?.distanceM).toBe(400);
	});

	it('skips non-foot and indoor activities', () => {
		expect(
			parseGarminActivity({ ...detail, summary: { ...detail.summary, activityType: 'CYCLING' } })
		).toBeNull();
		expect(isFootActivity('TREADMILL_RUNNING')).toBe(false);
		expect(isFootActivity('HIKING')).toBe(true);
	});

	it('skips activities without GPS', () => {
		expect(parseGarminActivity({ ...detail, samples: [{ startTimeInSeconds: start }] })).toBeNull();
	});

	it('uses activityId, falling back to summaryId', () => {
		expect(garminActivityKey(detail)).toBe('123');
		expect(garminActivityKey({ summaryId: 'abc-detail' })).toBe('abc-detail');
		expect(garminActivityKey({})).toBeNull();
	});
});
