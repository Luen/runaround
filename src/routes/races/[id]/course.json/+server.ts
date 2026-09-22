import { error } from '@sveltejs/kit';
import { courseOverlayFeatureCollection } from '$lib/geo';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * Race course as GeoJSON FeatureCollection (application/geo+json).
 * Map overlays fetch this URL so Network shows a real course request
 * (not the HTML race page / Vercel draft HEAD probe).
 */
async function courseResponse(slug: string): Promise<Response> {
	const [race] = await db.select().from(races).where(eq(races.slug, slug)).limit(1);
	if (!race) error(404, 'Race not found');

	const body = courseOverlayFeatureCollection([
		{ id: race.slug, title: race.title, geojson: race.courseGeojson }
	]);

	return new Response(JSON.stringify(body), {
		headers: {
			'Content-Type': 'application/geo+json; charset=utf-8',
			'Cache-Control': 'public, max-age=300'
		}
	});
}

export const GET: RequestHandler = async ({ params }) => courseResponse(params.id);

/** Explicit HEAD so probes get geo+json headers without a body (Kit can also derive HEAD from GET). */
export const HEAD: RequestHandler = async ({ params }) => {
	const res = await courseResponse(params.id);
	return new Response(null, { status: res.status, headers: res.headers });
};
