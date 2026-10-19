import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { geojsonToGpx, lineStringLengthMeters } from '$lib/geo';
import { parseDrawnCourse } from '$lib/routing';
import { routingAvailable } from '$lib/server/routing';
import { processUploadedGpx } from '$lib/server/elevation';
import { computeRaceStatus } from '$lib/server/sync';
import { endOfBrisbaneDay, parseBrisbaneInputValue } from '$lib/dates';
import { effectiveRaceStatus } from '$lib/matching';
import { raceEditable } from '$lib/race-edit';
import { enqueueNewRaceNewsletter } from '$lib/server/newsletter';
import type { Actions, PageServerLoad } from './$types';

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

const raceSchema = z.object({
	title: z.string().min(2),
	description: z.string().min(1),
	surface: z.enum(['road', 'trail']),
	startsAt: z.string(),
	endsAt: z.string(),
	stravaSegmentId: z.string().optional(),
	resultsRevealAt: z.string().optional(),
	teamSize: z.string().optional(),
	teamMaxSeparationM: z.string().optional(),
	teamMaxStartGapS: z.string().optional()
});

/** Optional positive integer form field; '' / missing → fallback. */
function intField(value: string | undefined, fallback: number | null): number | null {
	const n = Number.parseInt(value ?? '', 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const load: PageServerLoad = async () => {
	const all = await db.select().from(races).orderBy(desc(races.startsAt));
	return {
		// Show status from the clock (#221); editability is judged on the stored race.
		races: all.map((r) => ({ ...r, status: effectiveRaceStatus(r), editable: raceEditable(r) })),
		routingAvailable: routingAvailable()
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const parsed = raceSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { message: 'Check the race details' });
		const file = form.get('gpx');
		const drawn = parseDrawnCourse(form.get('drawnCourse'));
		let xml: string;
		if (file instanceof File && file.size > 0) {
			xml = await file.text();
		} else if (drawn) {
			// #209: a drawn course goes through the exact same pipeline as an uploaded GPX.
			xml = geojsonToGpx(parsed.data.title, drawn);
		} else {
			return fail(400, { message: 'Upload a GPX course or draw one on the map' });
		}
		let course: Awaited<ReturnType<typeof processUploadedGpx>>;
		try {
			course = await processUploadedGpx(parsed.data.title, xml);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Invalid GPX' });
		}
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
		const slugBase = slugify(parsed.data.title) || 'race';
		const slug = `${slugBase}-${Date.now().toString(36)}`;
		const status = computeRaceStatus(startsAt, endsAt);
		await db.insert(races).values({
			slug,
			title: parsed.data.title,
			description: parsed.data.description,
			surface: parsed.data.surface,
			startsAt,
			endsAt,
			status,
			stravaSegmentId: parsed.data.stravaSegmentId || null,
			resultsRevealAt,
			teamSize: intField(parsed.data.teamSize, null),
			teamMaxSeparationM: intField(parsed.data.teamMaxSeparationM, 1000) ?? 1000,
			teamMaxStartGapS: intField(parsed.data.teamMaxStartGapS, 300) ?? 300,
			courseGeojson: course.courseGeojson,
			gpx: course.gpx,
			distanceM: lineStringLengthMeters(course.courseGeojson),
			elevationGainM: course.elevationGainM
		});
		// Announce a newly published race (#168); closed test races are not news.
		if (status === 'upcoming' || status === 'live') {
			try {
				await enqueueNewRaceNewsletter();
			} catch (err) {
				// The race is already saved; a failed announcement must not hide that.
				console.error('New-race newsletter could not be queued', err);
			}
		}
		throw redirect(303, `/races/${slug}`);
	}
};
