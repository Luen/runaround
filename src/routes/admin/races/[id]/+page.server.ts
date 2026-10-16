import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { geojsonToGpx } from '$lib/geo';
import { courseElevation, processUploadedGpx } from '$lib/server/elevation';
import { computeRaceStatus } from '$lib/server/sync';
import { endOfBrisbaneDay, parseBrisbaneInputValue } from '$lib/dates';
import { raceEditable } from '$lib/race-edit';
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
	title: z.string().min(2),
	description: z.string().min(1),
	surface: z.enum(['road', 'trail']),
	startsAt: z.string(),
	endsAt: z.string(),
	stravaSegmentId: z.string().optional(),
	resultsRevealAt: z.string().optional()
});

export const load: PageServerLoad = async ({ params }) => {
	const [race] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
	if (!race) error(404, 'Race not found');
	return { race, editable: raceEditable(race) };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const [race] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
		if (!race) error(404, 'Race not found');
		if (!raceEditable(race)) {
			return fail(403, { message: 'This race has finished and can no longer be edited.' });
		}
		const form = await request.formData();
		const parsed = schema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { message: 'Check the race details' });
		let startsAt: Date;
		let endsAt: Date;
		try {
			// Admin inputs are Brisbane wall-clock times, independent of the server's TZ.
			startsAt = parseBrisbaneInputValue(parsed.data.startsAt);
			endsAt = endOfBrisbaneDay(parseBrisbaneInputValue(parsed.data.endsAt));
		} catch {
			return fail(400, { message: 'Check the race dates' });
		}
		let resultsRevealAt: Date | null = null;
		if (parsed.data.resultsRevealAt?.trim()) {
			try {
				resultsRevealAt = parseBrisbaneInputValue(parsed.data.resultsRevealAt);
			} catch {
				return fail(400, { message: 'Check the results reveal date' });
			}
		}
		let courseGeojson = race.courseGeojson;
		let gpx = race.gpx;
		let elevationGainM = race.elevationGainM;
		const file = form.get('gpx');
		if (file instanceof File && file.size > 0) {
			try {
				({ courseGeojson, gpx, elevationGainM } = await processUploadedGpx(
					parsed.data.title,
					await file.text()
				));
			} catch (err) {
				return fail(400, { message: err instanceof Error ? err.message : 'Invalid GPX' });
			}
		} else if (!elevationGainM) {
			// Existing course saved without elevation: fill it in on the next save.
			try {
				const enriched = await courseElevation(
					gpx ?? geojsonToGpx(parsed.data.title, courseGeojson),
					courseGeojson
				);
				elevationGainM = enriched.elevationGainM;
				gpx = geojsonToGpx(parsed.data.title, courseGeojson, enriched.elevations);
			} catch (err) {
				console.error('Elevation lookup failed', err);
			}
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
				resultsRevealAt,
				courseGeojson,
				gpx,
				elevationGainM,
				updatedAt: new Date()
			})
			.where(eq(races.id, race.id));
		throw redirect(303, `/races/${race.slug}`);
	}
};
