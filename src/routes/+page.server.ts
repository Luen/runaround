import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { effectiveRaceStatus } from '$lib/matching';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		// Derive status from the clock (#221): the stored value only advances when the
		// worker runs, so a race must not stay "upcoming" on the homepage if it is live.
		const all = await db.select().from(races).orderBy(desc(races.startsAt));
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
