import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { parseGpxToLineString, geojsonToGpx, endOfLocalDay } from '$lib/geo';
import { computeRaceStatus } from '$lib/server/sync';
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
	title: z.string().min(2),
	description: z.string().min(1),
	surface: z.enum(['road', 'trail']),
	startsAt: z.string(),
	endsAt: z.string(),
	stravaSegmentId: z.string().optional()
});

export const load: PageServerLoad = async ({ params }) => {
	const [race] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
	if (!race) error(404, 'Race not found');
	return { race };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const [race] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
		if (!race) error(404, 'Race not found');
		const form = await request.formData();
		const parsed = schema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { message: 'Check the race details' });
		const startsAt = new Date(parsed.data.startsAt);
		const endsAt = endOfLocalDay(new Date(parsed.data.endsAt));
		let courseGeojson = race.courseGeojson;
		let gpx = race.gpx;
		const file = form.get('gpx');
		if (file instanceof File && file.size > 0) {
			courseGeojson = parseGpxToLineString(await file.text());
			gpx = geojsonToGpx(parsed.data.title, courseGeojson);
		}
		await db
			.update(races)
			.set({
				title: parsed.data.title,
				description: parsed.data.description,
				surface: parsed.data.surface,
				startsAt,
				endsAt,
				status: computeRaceStatus(startsAt, endsAt),
				stravaSegmentId: parsed.data.stravaSegmentId || null,
				courseGeojson,
				gpx,
				updatedAt: new Date()
			})
			.where(eq(races.id, race.id));
		throw redirect(303, `/races/${race.slug}`);
	}
};
