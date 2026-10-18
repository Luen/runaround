import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account, attempts, races } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { resultsHidden } from '$lib/reveal';
import { ingestUploadedGpx } from '$lib/server/upload';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
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
	// Embargoed races (#206): confirm the attempt, but not the time.
	return {
		mine: rows.map(({ resultsRevealAt, timeMs, ...rest }) => {
			const hidden = !locals.user?.isAdmin && resultsHidden({ resultsRevealAt });
			return { ...rest, timeMs: hidden ? null : timeMs, hidden };
		}),
		hasStrava: Boolean(strava),
		stravaNeedsReconnect: Boolean(locals.user.stravaAthleteId) && !strava
	};
};

export const actions: Actions = {
	upload: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const file = (await request.formData()).get('activity');
		if (!(file instanceof File)) return fail(400, { uploadError: 'Choose a GPX file to upload.' });
		const result = await ingestUploadedGpx(locals.user.id, file);
		if (!result.ok) return fail(400, { uploadError: result.message });
		return { uploaded: result.matched };
	}
};
