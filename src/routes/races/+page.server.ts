import { filterRaceWindow, rankedLeaderboard } from '$lib/boards';
import { db } from '$lib/server/db';
import { attempts, races } from '$lib/server/db/schema';
import { desc, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

type BoardLeader = { name: string; timeMs: number };

function leaderFromBoard(
	rows: Parameters<typeof rankedLeaderboard>[0]
): BoardLeader | null {
	const [top] = rankedLeaderboard(rows);
	if (!top) return null;
	return { name: top.name, timeMs: top.timeMs };
}

export const load: PageServerLoad = async ({ url }) => {
	const surface = url.searchParams.get('surface');
	try {
		const all = await db.select().from(races).orderBy(desc(races.startsAt));
		const filtered =
			surface === 'road' || surface === 'trail' ? all.filter((r) => r.surface === surface) : all;

		const ids = filtered.map((r) => r.id);
		const attemptRows =
			ids.length === 0
				? []
				: await db
						.select({
							id: attempts.id,
							raceId: attempts.raceId,
							userId: attempts.userId,
							stravaAthleteId: attempts.stravaAthleteId,
							timeMs: attempts.timeMs,
							startedAt: attempts.startedAt,
							importedName: attempts.importedName,
							source: attempts.source,
							effortUrl: attempts.effortUrl
						})
						.from(attempts)
						.where(inArray(attempts.raceId, ids));

		const byRace = new Map<string, typeof attemptRows>();
		for (const row of attemptRows) {
			const list = byRace.get(row.raceId);
			if (list) list.push(row);
			else byRace.set(row.raceId, [row]);
		}

		const racesWithSummaries = filtered.map((race) => {
			const raceAttempts = byRace.get(race.id) ?? [];
			const allTime = leaderFromBoard(raceAttempts);
			const raceWinner =
				race.status === 'closed'
					? leaderFromBoard(filterRaceWindow(raceAttempts, race.startsAt, race.endsAt))
					: null;
			return { ...race, allTime, raceWinner };
		});

		return {
			races: racesWithSummaries,
			surface: surface === 'road' || surface === 'trail' ? surface : 'all'
		};
	} catch (err) {
		console.error(err);
		return { races: [], surface: 'all' as const };
	}
};
