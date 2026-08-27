import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { overallLeaderboard, raceLeaderboard } from '$lib/server/leaderboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [race] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
	if (!race) error(404, 'Race not found');
	const [raceBoard, overall] = await Promise.all([
		raceLeaderboard(race.id),
		overallLeaderboard(race.id)
	]);
	return { race, raceBoard, overall };
};
