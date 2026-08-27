import { db } from './db';
import { attempts, races } from './db/schema';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { rankedLeaderboard, type RankedRow } from '../boards';

export type LeaderboardRow = RankedRow;

export async function raceLeaderboard(raceId: string): Promise<LeaderboardRow[]> {
	const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
	if (!race) return [];
	const rows = await db
		.select()
		.from(attempts)
		.where(
			and(
				eq(attempts.raceId, raceId),
				gte(attempts.startedAt, race.startsAt),
				lte(attempts.startedAt, race.endsAt)
			)
		)
		.orderBy(asc(attempts.timeMs));
	return rankedLeaderboard(rows);
}

export async function overallLeaderboard(raceId: string): Promise<LeaderboardRow[]> {
	const rows = await db
		.select()
		.from(attempts)
		.where(eq(attempts.raceId, raceId))
		.orderBy(asc(attempts.timeMs));
	return rankedLeaderboard(rows);
}

export async function userRankOnBoard(
	raceId: string,
	userId: string,
	board: 'race' | 'overall'
): Promise<number | null> {
	const rows = board === 'race' ? await raceLeaderboard(raceId) : await overallLeaderboard(raceId);
	return rows.find((r) => r.userId === userId)?.rank ?? null;
}
