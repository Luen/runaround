import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { building } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueJob } from './jobs';

const origin = process.env.ORIGIN ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:5173';
const devSecret = 'dev-only-insecure-secret-change-me-32';
const buildSecret = 'build-time-placeholder-not-for-production!!';
const placeholderEmail = (athleteId: string) => `strava-${athleteId}@users.runaround.invalid`;

function authSecret(): string {
	if (building) return buildSecret;
	const secret = process.env.BETTER_AUTH_SECRET;
	if (secret && secret !== devSecret) return secret;
	return devSecret;
}

export const auth = betterAuth({
	baseURL: origin,
	secret: authSecret(),
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	emailAndPassword: { enabled: false },
	user: {
		additionalFields: {
			stravaAthleteId: { type: 'string', required: false, input: false },
			isAdmin: { type: 'boolean', required: false, defaultValue: false, input: false },
			needsEmail: { type: 'boolean', required: false, defaultValue: true, input: false }
		}
	},
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: 'strava',
					name: 'Strava',
					accountIssuer: 'local:oauth:strava',
					clientId: process.env.STRAVA_CLIENT_ID ?? '',
					clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
					authorizationUrl: 'https://www.strava.com/oauth/authorize',
					tokenUrl: 'https://www.strava.com/oauth/token',
					pkce: false,
					scopes: ['read', 'activity:read_all', 'profile:read_all'],
					authorizationUrlParams: { approval_prompt: 'auto' },
					getUserInfo: async (tokens) => {
						const token =
							tokens.accessToken ??
							(tokens as { access_token?: string }).access_token;
						if (!token) return null;
						const res = await fetch('https://www.strava.com/api/v3/athlete', {
							headers: { Authorization: `Bearer ${token}` }
						});
						if (!res.ok) return null;
						const athlete = (await res.json()) as {
							id: number;
							firstname?: string;
							lastname?: string;
							profile?: string;
						};
						const id = String(athlete.id);
						return {
							id,
							name: `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim() || 'Runner',
							email: placeholderEmail(id),
							emailVerified: false,
							image: athlete.profile
						};
					}
				}
			]
		}),
		sveltekitCookies(getRequestEvent)
	],
	databaseHooks: {
		user: {
			create: {
				after: async (created) => {
					const athleteId = created.email?.startsWith('strava-')
						? created.email.slice('strava-'.length).split('@')[0]
						: null;
					if (athleteId) {
						await db
							.update(schema.user)
							.set({ stravaAthleteId: athleteId, needsEmail: true })
							.where(eq(schema.user.id, created.id));
						await db
							.update(schema.attempts)
							.set({ userId: created.id })
							.where(eq(schema.attempts.stravaAthleteId, athleteId));
					}
					await enqueueJob('backfill', { userId: created.id });
				}
			}
		}
	}
});
