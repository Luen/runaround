import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { parseGpxToLineString, geojsonToGpx, pointsFromLineString, endOfLocalDay, type LineString } from '$lib/geo';
import { haversineMeters } from '$lib/geo';
import { computeRaceStatus } from '$lib/server/sync';
import type { Actions, PageServerLoad } from './$types';

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function distanceM(geojson: LineString): number {
	const pts = pointsFromLineString(geojson);
	let d = 0;
	for (let i = 1; i < pts.length; i += 1) d += haversineMeters(pts[i - 1], pts[i]);
	return d;
}

const raceSchema = z.object({
	title: z.string().min(2),
	description: z.string().min(1),
	surface: z.enum(['road', 'trail']),
	startsAt: z.string(),
	endsAt: z.string(),
	stravaSegmentId: z.string().optional()
});

export const load: PageServerLoad = async () => {
	const all = await db.select().from(races).orderBy(desc(races.startsAt));
	return { races: all };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const parsed = raceSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { message: 'Check the race details' });
		const file = form.get('gpx');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Upload a GPX course' });
		}
		const xml = await file.text();
		let courseGeojson: LineString;
		try {
			courseGeojson = parseGpxToLineString(xml);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Invalid GPX' });
		}
		const startsAt = new Date(parsed.data.startsAt);
		const endsAt = endOfLocalDay(new Date(parsed.data.endsAt));
		const slugBase = slugify(parsed.data.title) || 'race';
		const slug = `${slugBase}-${Date.now().toString(36)}`;
		await db.insert(races).values({
			slug,
			title: parsed.data.title,
			description: parsed.data.description,
			surface: parsed.data.surface,
			startsAt,
			endsAt,
			status: computeRaceStatus(startsAt, endsAt),
			stravaSegmentId: parsed.data.stravaSegmentId || null,
			courseGeojson,
			gpx: geojsonToGpx(parsed.data.title, courseGeojson),
			distanceM: distanceM(courseGeojson)
		});
		throw redirect(303, `/races/${slug}`);
	}
};
