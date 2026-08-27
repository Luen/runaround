export type RankableAttempt = {
	id: string;
	userId: string | null;
	stravaAthleteId: string | null;
	timeMs: number;
	startedAt: Date;
	importedName: string | null;
	source: string;
};

export type RankedRow = {
	rank: number;
	name: string;
	timeMs: number;
	startedAt: Date;
	userId: string | null;
	stravaAthleteId: string | null;
	source: string;
};

export function participantKey(row: RankableAttempt): string {
	return row.userId ?? `athlete:${row.stravaAthleteId ?? row.id}`;
}

export function bestByParticipant(rows: RankableAttempt[]): RankableAttempt[] {
	const best = new Map<string, RankableAttempt>();
	for (const row of rows) {
		const key = participantKey(row);
		const current = best.get(key);
		if (!current || row.timeMs < current.timeMs) best.set(key, row);
	}
	return [...best.values()].sort(
		(a, b) => a.timeMs - b.timeMs || a.startedAt.getTime() - b.startedAt.getTime()
	);
}

export function rankedLeaderboard(rows: RankableAttempt[]): RankedRow[] {
	return bestByParticipant(rows).map((row, i) => ({
		rank: i + 1,
		name: row.importedName?.trim() || 'Unknown',
		timeMs: row.timeMs,
		startedAt: row.startedAt,
		userId: row.userId,
		stravaAthleteId: row.stravaAthleteId,
		source: row.source
	}));
}

export function filterRaceWindow<T extends { startedAt: Date }>(
	rows: T[],
	startsAt: Date,
	endsAt: Date
): T[] {
	return rows.filter((row) => row.startedAt >= startsAt && row.startedAt <= endsAt);
}
