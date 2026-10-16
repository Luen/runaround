import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account, attempts, races } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const mine = await db
		.select({
			timeMs: attempts.timeMs,
			startedAt: attempts.startedAt,
			title: races.title,
			slug: races.slug,
			source: attempts.source
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
	return {
		mine,
		hasStrava: Boolean(strava),
		stravaNeedsReconnect: Boolean(locals.user.stravaAthleteId) && !strava
	};
};
