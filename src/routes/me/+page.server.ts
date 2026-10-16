import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { attempts, races } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { resultsHidden } from '$lib/reveal';
import { ingestUploadedGpx } from '$lib/server/upload';
import { garminEnabled } from '$lib/garmin';
import { disconnectGarmin, garminAccountFor } from '$lib/server/garmin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
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
		})
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
	}
};
