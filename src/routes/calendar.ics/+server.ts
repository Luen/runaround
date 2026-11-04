import { buildCalendarFeed } from '#lib/calendar.js';
import { siteOrigin } from '#lib/origin.js';
import { db } from '#lib/server/db/index.js';
import { races } from '#lib/server/db/schema.js';
import { asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Public subscription feed of every published race window (#171). */
export const GET: RequestHandler = async ({ url }) => {
	const origin = siteOrigin(process.env.ORIGIN, url.origin);
	const published = await db
		.select({
			id: races.id,
			slug: races.slug,
			title: races.title,
			description: races.description,
			status: races.status,
			startsAt: races.startsAt,
			endsAt: races.endsAt
		})
		.from(races)
		.orderBy(asc(races.startsAt));

	const body = buildCalendarFeed({
		origin,
		races: published.filter((race) => race.status !== 'draft')
	});
	return new Response(body, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="runaround.ics"',
			'Cache-Control': 'public, max-age=300'
		}
	});
};
