import { raceListingColumns } from '#lib/server/race-select.js';
import { db } from '#lib/server/db/index.js';
import { races } from '#lib/server/db/schema.js';
import { desc } from 'drizzle-orm';
import { effectiveRaceStatus } from '#lib/matching.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		// Derive status from the clock (#221): the stored value only advances when the
		// worker runs, so a race must not stay "upcoming" on the homepage if it is live.
		// Omit gpx / courseGeojson (#260) — maps fetch course.json per race.
		const all = await db.select(raceListingColumns).from(races).orderBy(desc(races.startsAt));
		const published = all
			.map((race) => ({ ...race, status: effectiveRaceStatus(race) }))
			.filter((race) => race.status !== 'draft');
		return {
			races: published.filter((race) => race.status === 'live' || race.status === 'upcoming'),
			pastRaces: published.filter((race) => race.status === 'closed')
		};
	} catch (err) {
		console.error(err);
		return { races: [], pastRaces: [] };
	}
};
