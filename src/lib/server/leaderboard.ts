import { db } from './db';
import { attempts, races } from './db/schema';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { participantKey, rankedLeaderboard, type RankedRow } from '../boards';
import { DEFAULT_TEAM_RULES, findTeams, type TeamResult } from '../teams';

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

/** Team board (#207) from race-window attempts that carry an on-course trace. */
export async function teamLeaderboard(raceId: string): Promise<TeamResult[]> {
	const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
	if (!race?.teamSize) return [];
	const rows = await db
		.select()
		.from(attempts)
		.where(
			and(
				eq(attempts.raceId, raceId),
				gte(attempts.startedAt, race.startsAt),
				lte(attempts.startedAt, race.endsAt)
			)
		);
	return findTeams(
		rows
			.filter((r) => r.trace && r.trace.length >= 2)
			.map((r) => ({
				attemptId: r.id,
				participantKey: participantKey(r),
				name: r.importedName?.trim() || 'Unknown',
				timeMs: r.timeMs,
				trace: r.trace ?? []
			})),
		{
			...DEFAULT_TEAM_RULES,
			size: race.teamSize,
			maxSeparationM: race.teamMaxSeparationM,
			maxStartGapS: race.teamMaxStartGapS,
			maxFinishGapS: race.teamMaxStartGapS
		}
	);
}
