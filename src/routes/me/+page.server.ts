import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account, attempts, races, user } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { resultsHidden } from '$lib/reveal';
import { ingestUploadedGpx } from '$lib/server/upload';
import { claimPendingNewsletterOptIn, setNewsletterOptIn } from '$lib/server/newsletter';
import { garminEnabled } from '$lib/garmin';
import { disconnectGarmin, garminAccountFor } from '$lib/server/garmin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/login');
	// Consent ticked on the login form for an existing runner (#168).
	if (!locals.user.newsletterOptIn) {
		await claimPendingNewsletterOptIn(locals.user.id, locals.user.email);
	}
	const rows = await db
		.select({
			timeMs: attempts.timeMs,
			startedAt: attempts.startedAt,
			title: races.title,
			slug: races.slug,
			source: attempts.source,
			resultsRevealAt: races.resultsRevealAt
		})
		.from(attempts)
		.innerJoin(races, eq(attempts.raceId, races.id))
		.where(eq(attempts.userId, locals.user.id))
		.orderBy(desc(attempts.startedAt));
	const [strava] = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, locals.user.id), eq(account.providerId, 'strava')))
		.limit(1);
	const [preference] = await db
		.select({
			email: user.email,
			needsEmail: user.needsEmail,
			newsletterOptIn: user.newsletterOptIn
		})
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);
	// Embargoed races (#206): confirm the attempt, but not the time.
	const garmin = garminEnabled()
		? {
				connected: Boolean(await garminAccountFor(locals.user.id)),
				status: url.searchParams.get('garmin')
			}
		: null;
	return {
		garmin,
		mine: rows.map(({ resultsRevealAt, timeMs, ...rest }) => {
			const hidden = !locals.user?.isAdmin && resultsHidden({ resultsRevealAt });
			return { ...rest, timeMs: hidden ? null : timeMs, hidden };
		}),
		hasStrava: Boolean(strava),
		stravaNeedsReconnect: Boolean(locals.user.stravaAthleteId) && !strava,
		newsletter: {
			email: preference?.email ?? locals.user.email,
			needsEmail: preference?.needsEmail ?? locals.user.needsEmail,
			optIn: Boolean(preference?.newsletterOptIn)
		}
	};
};

export const actions: Actions = {
	disconnectGarmin: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		await disconnectGarmin(locals.user.id);
		return { garminDisconnected: true };
	},
	upload: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const file = (await request.formData()).get('activity');
		if (!(file instanceof File)) return fail(400, { uploadError: 'Choose a GPX file to upload.' });
		const result = await ingestUploadedGpx(locals.user.id, file);
		if (!result.ok) return fail(400, { uploadError: result.message });
		return { uploaded: result.matched };
	},
	newsletter: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const enabled = (await request.formData()).get('enabled') === 'on';
		await setNewsletterOptIn(locals.user.id, enabled);
		return { newsletterUpdated: enabled };
	}
};
