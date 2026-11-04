/**
 * #208: admins may edit a race until it has finished. Closed/past races are
 * read-only so final results and the course they were matched on stay fixed.
 * Always judge the *stored* race, never the submitted form, so an edit can't
 * reopen a finished race (or close one to dodge the rule).
 */
export type EditableRace = { status: string; endsAt: Date | string };

export function raceEditable(race: EditableRace, now: Date = new Date()): boolean {
	if (race.status === 'closed') return false;
	const ends = race.endsAt instanceof Date ? race.endsAt : new Date(race.endsAt);
	return !(ends.getTime() < now.getTime());
}
