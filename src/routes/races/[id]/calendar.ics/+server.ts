import { error } from '@sveltejs/kit';
import { buildCalendarFeed } from '$lib/calendar';
import { siteOrigin } from '$lib/origin';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** One race window, for "Add to calendar" downloads (#171). */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const [race] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
	if (!race) error(404, 'Race not found');
	// Drafts are not public (#237); admins can still preview their calendar entry.
	if (race.status === 'draft' && !locals.user?.isAdmin) error(404, 'Race not found');

	const origin = siteOrigin(process.env.ORIGIN, url.origin);
	const body = buildCalendarFeed({
		origin,
		races: [race],
		name: `${race.title} — RunAround`,
		description: `Race window for ${race.title}. ${race.description}`.trim()
	});
	return new Response(body, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="${race.slug}.ics"`,
			'Cache-Control': 'public, max-age=300'
		}
	});
};
