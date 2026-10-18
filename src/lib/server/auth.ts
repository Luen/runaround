import { betterAuth } from 'better-auth/minimal';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { magicLink } from 'better-auth/plugins/magic-link';
import { building, dev } from '$app/environment';
import { authBaseUrl } from '$lib/origin';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { and, eq, ne, sql } from 'drizzle-orm';
import { enqueueJob } from './jobs';
import { sendEmail } from './email';
import { adminEmails, isPlaceholderEmail } from './identity';
import { MAGIC_LINK_EXPIRES_S, magicLinkEmail, magicLinkEnabled } from './magic-link';

// Empty/unset ORIGIN must not fall back to localhost in production: better-auth's
// SvelteKit handler only serves /api/auth/* when the request origin matches
// baseURL, so a wrong baseURL 404s every auth route. Undefined = infer per request.
const origin = authBaseUrl(process.env['ORIGIN'], process.env['BETTER_AUTH_URL'], dev);
const devSecret = 'dev-only-insecure-secret-change-me-32';
const buildSecret = 'build-time-placeholder-not-for-production!!';
const placeholderEmail = (athleteId: string) => `strava-${athleteId}@users.runaround.invalid`;

function authSecret(): string {
	if (building) return buildSecret;
	const secret = process.env['BETTER_AUTH_SECRET'];
	if (secret && secret !== devSecret) return secret;
	// Never sign sessions with the repo-committed dev secret in production (#231):
	// anyone who can read this repo could forge a session cookie.
	if (dev) return devSecret;
	throw new Error('BETTER_AUTH_SECRET must be set to a unique secret in production');
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
	account: {
		// Lets a signed-in email (magic-link) runner connect Strava from /me; Strava
		// never shares a real email, so the addresses always differ.
		accountLinking: { enabled: true, allowDifferentEmails: true }
	},
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
						const token = tokens.accessToken ?? (tokens as { access_token?: string }).access_token;
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
		magicLink({
			expiresIn: MAGIC_LINK_EXPIRES_S,
			storeToken: 'hashed',
			allowedAttempts: 1,
			rateLimit: { window: 60, max: 3 },
			sendMagicLink: async ({ email, url }) => {
				// Feature flag: the endpoint stays mounted but sends nothing when off.
				if (!magicLinkEnabled()) throw new Error('Email sign-in is not enabled');
				const result = await sendEmail({ to: email, ...magicLinkEmail({ url }) });
				if (!result.ok) {
					console.error('Magic link email failed', result.error);
					throw new Error('Could not send the sign-in email');
				}
			}
		}),
		sveltekitCookies(getRequestEvent)
	],
	databaseHooks: {
		account: {
			create: {
				before: async (created) => {
					if (created.providerId === 'strava') {
						const [u] = await db
							.select()
							.from(schema.user)
							.where(eq(schema.user.id, created.userId))
							.limit(1);
						if (u?.stravaAthleteId && u.stravaAthleteId !== created.accountId) {
							throw new APIError('BAD_REQUEST', {
								message: 'Reconnect the Strava athlete already associated with this runner'
							});
						}
					}
					return { data: created };
				},
				after: async (created) => {
					// Strava linked to an existing (e.g. magic-link) user (#204): adopt the athlete id,
					// claim imported attempts and backfill, including reconnection after email proof cleanup.
					if (created.providerId !== 'strava') return;
					const [u] = await db
						.select()
						.from(schema.user)
						.where(eq(schema.user.id, created.userId))
						.limit(1);
					if (!u) return;
					// `user.strava_athlete_id` is unique. A runner whose Strava link was removed by
					// email-proof cleanup still holds the id; this account just proved ownership
					// through OAuth, so release it instead of failing the callback on the constraint.
					await db
						.update(schema.user)
						.set({ stravaAthleteId: null })
						.where(
							and(
								eq(schema.user.stravaAthleteId, created.accountId),
								ne(schema.user.id, u.id),
								sql`not exists (select 1 from ${schema.account} where ${schema.account.userId} = ${schema.user.id} and ${schema.account.providerId} = 'strava')`
							)
						);
					await db
						.update(schema.user)
						.set({ stravaAthleteId: created.accountId })
						.where(eq(schema.user.id, u.id));
					await db
						.update(schema.attempts)
						.set({ userId: u.id })
						.where(eq(schema.attempts.stravaAthleteId, created.accountId));
					await enqueueJob('backfill', { userId: u.id });
				}
			}
		},
		user: {
			create: {
				before: async (created) => {
					// Magic-link proof comes from Better Auth, never from an email prefix.
					const verified = created.emailVerified && !isPlaceholderEmail(created.email);
					return {
						data: {
							...created,
							needsEmail: !verified,
							isAdmin: Boolean(verified && adminEmails().includes(created.email.toLowerCase()))
						}
					};
				}
			}
		}
	}
});
