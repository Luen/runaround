import { races } from '$lib/server/db/schema';

/**
 * Public listing / map pages must not ship `gpx` (large XML) or `courseGeojson`
 * (fetched via `/races/:slug/course.json` instead). Keep this column list in sync
 * with `races` fields the homepage and `/races` actually render.
 */
export const raceListingColumns = {
	id: races.id,
	slug: races.slug,
	title: races.title,
	stravaName: races.stravaName,
	description: races.description,
	surface: races.surface,
	startsAt: races.startsAt,
	endsAt: races.endsAt,
	status: races.status,
	stravaSegmentId: races.stravaSegmentId,
	distanceM: races.distanceM,
	elevationGainM: races.elevationGainM,
	elevationProfileUrl: races.elevationProfileUrl,
	resultsRevealAt: races.resultsRevealAt,
	teamSize: races.teamSize,
	teamMaxSeparationM: races.teamMaxSeparationM,
	teamMaxStartGapS: races.teamMaxStartGapS,
	createdAt: races.createdAt,
	updatedAt: races.updatedAt
} as const;

/** Drop heavy blobs before serializing a race into page data (#260). */
export function withoutCourseBlobs<T extends { gpx?: unknown; courseGeojson?: unknown }>(
	race: T
): Omit<T, 'gpx' | 'courseGeojson'> {
	const rest = { ...race };
	delete rest.gpx;
	delete rest.courseGeojson;
	return rest;
}
