/**
 * Results embargo (#206): a race may hide times and ranks until `resultsRevealAt`.
 * Pure helpers so the rule is shared by pages, the worker and tests.
 */
export type RevealableRace = { resultsRevealAt: Date | string | null };

/** True while the race has a reveal date that has not passed yet. */
export function resultsHidden(race: RevealableRace, now: Date = new Date()): boolean {
	if (!race.resultsRevealAt) return false;
	const at =
		race.resultsRevealAt instanceof Date ? race.resultsRevealAt : new Date(race.resultsRevealAt);
	if (Number.isNaN(at.getTime())) return false;
	return now < at;
}

/** Admins always see results (for ops); everyone else waits for the reveal. */
export function canSeeResults(
	race: RevealableRace,
	viewer: { isAdmin?: boolean | null } | null | undefined,
	now: Date = new Date()
): boolean {
	return Boolean(viewer?.isAdmin) || !resultsHidden(race, now);
}
