import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { attempts, races } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { resultsHidden } from '$lib/reveal';
import type { PageServerLoad } from './$types';

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
	// Embargoed races (#206): confirm the attempt, but not the time.
	return {
		mine: rows.map(({ resultsRevealAt, timeMs, ...rest }) => {
			const hidden = !locals.user?.isAdmin && resultsHidden({ resultsRevealAt });
			return { ...rest, timeMs: hidden ? null : timeMs, hidden };
		})
	};
};
