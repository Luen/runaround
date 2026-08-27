import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { geojsonToGpx } from '$lib/geo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const [race] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
	if (!race) error(404, 'Race not found');
	const gpx = race.gpx ?? geojsonToGpx(race.title, race.courseGeojson);
	return new Response(gpx, {
		headers: {
			'Content-Type': 'application/gpx+xml',
			'Content-Disposition': `attachment; filename="${race.slug}.gpx"`
		}
	});
};
