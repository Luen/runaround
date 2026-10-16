import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { attempts, races } from '$lib/server/db/schema';
import { and, count, eq } from 'drizzle-orm';
import { overallLeaderboard, raceLeaderboard, teamLeaderboard } from '$lib/server/leaderboard';
import { effectiveRaceStatus } from '$lib/matching';
import { ensureRaceElevation } from '$lib/server/elevation-backfill';
import { canSeeResults, resultsHidden } from '$lib/reveal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [row] = await db.select().from(races).where(eq(races.slug, params.id)).limit(1);
	if (!row) error(404, 'Race not found');
	const stored = await ensureRaceElevation(row);
	// Derive status from the clock (#221) so the page is correct even when the worker
	// has not persisted the upcoming → live → closed transition yet.
	const race = { ...stored, status: effectiveRaceStatus(stored) };
	const hidden = resultsHidden(race);
	const visible = canSeeResults(race, locals.user);

	// Embargoed: never send times/ranks to the browser. Runners only learn that
	// their attempt was recorded.
	let myAttempts = 0;
	if (hidden && locals.user) {
		const [c] = await db
			.select({ n: count() })
			.from(attempts)
			.where(and(eq(attempts.raceId, race.id), eq(attempts.userId, locals.user.id)));
		myAttempts = Number(c?.n ?? 0);
	}

	const [raceBoard, overall, teams] = visible
		? await Promise.all([
				raceLeaderboard(race.id),
				overallLeaderboard(race.id),
				race.teamSize ? teamLeaderboard(race.id) : Promise.resolve([])
			])
		: [[], [], []];
	return {
		race,
		raceBoard,
		overall,
		teams,
		resultsHidden: hidden,
		resultsVisible: visible,
		myAttempts
	};
};
