export type RankableAttempt = {
	id: string;
	userId: string | null;
	stravaAthleteId: string | null;
	timeMs: number;
	startedAt: Date;
	importedName: string | null;
	source: string;
	effortUrl: string | null;
};

export type RankedRow = {
	rank: number;
	name: string;
	timeMs: number;
	startedAt: Date;
	userId: string | null;
	stravaAthleteId: string | null;
	source: string;
	effortUrl: string | null;
	/** Completed attempts by this runner on the board's attempt set (race window or all-time). */
	completions: number;
};

export type SortKey = 'rank' | 'time' | 'completions';
export type SortDir = 'asc' | 'desc';

/** Sort leaderboard rows for display; place (`rank`) stays attached to each row. Ties fall back to place. */
export function sortRankedRows<T extends { rank: number; timeMs: number; completions: number }>(
	rows: T[],
	key: SortKey,
	dir: SortDir
): T[] {
	const sign = dir === 'asc' ? 1 : -1;
	const value = (r: T) =>
		key === 'time' ? r.timeMs : key === 'completions' ? r.completions : r.rank;
	return [...rows].sort((a, b) => sign * (value(a) - value(b)) || a.rank - b.rank);
}

/** Default direction when a header is first clicked: fastest/place first, most completions first. */
export function defaultSortDir(key: SortKey): SortDir {
	return key === 'completions' ? 'desc' : 'asc';
}

/** Returns the URL when it is a safe http(s) absolute URL; otherwise null. */
export function safeHttpUrl(url: string | null | undefined): string | null {
	if (!url?.trim()) return null;
	try {
		const parsed = new URL(url.trim());
		if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
	} catch {
		// invalid URL
	}
	return null;
}

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

export function completionCounts(rows: RankableAttempt[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const row of rows) {
		const key = participantKey(row);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

export function rankedLeaderboard(rows: RankableAttempt[]): RankedRow[] {
	const counts = completionCounts(rows);
	return bestByParticipant(rows).map((row, i) => ({
		rank: i + 1,
		name: row.importedName?.trim() || 'Unknown',
		timeMs: row.timeMs,
		startedAt: row.startedAt,
		userId: row.userId,
		stravaAthleteId: row.stravaAthleteId,
		source: row.source,
		effortUrl: row.effortUrl,
		completions: counts.get(participantKey(row)) ?? 1
	}));
}

export function filterRaceWindow<T extends { startedAt: Date }>(
	rows: T[],
	startsAt: Date,
	endsAt: Date
): T[] {
	return rows.filter((row) => row.startedAt >= startsAt && row.startedAt <= endsAt);
}
