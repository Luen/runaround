import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { races } from './db/schema';
import { geojsonToGpx } from '../geo';
import { courseElevation } from './elevation';
import { needsElevationBackfill, withTimeout } from '../elevation-backfill-policy';

type RaceRow = typeof races.$inferSelect;

/**
 * Fill elevation for one race saved with 0 m gain and persist it. Idempotent:
 * the update only applies while the stored gain is still 0. Returns the new
 * gain, or null when nothing changed.
 */
export async function backfillRaceElevation(race: RaceRow): Promise<number | null> {
	if (!needsElevationBackfill(race)) return null;
	const xml = race.gpx ?? geojsonToGpx(race.title, race.courseGeojson);
	const { elevations, elevationGainM } = await courseElevation(xml, race.courseGeojson);
	if (elevationGainM <= 0) return null;
	await db
		.update(races)
		.set({
			elevationGainM,
			gpx: geojsonToGpx(race.title, race.courseGeojson, elevations),
			updatedAt: new Date()
		})
		.where(and(eq(races.id, race.id), eq(races.elevationGainM, 0)));
	return elevationGainM;
}

/**
 * Race-page read path: production has no long-running worker, so the
 * worker-start backfill never ran there. Try once on view, bounded so a slow
 * tile server can't hold the page; failures just keep the stored 0.
 */
export async function ensureRaceElevation(race: RaceRow, timeoutMs = 8000): Promise<RaceRow> {
	if (!needsElevationBackfill(race)) return race;
	try {
		const gain = await withTimeout(backfillRaceElevation(race), timeoutMs);
		return gain ? { ...race, elevationGainM: gain } : race;
	} catch (err) {
		console.error(`Elevation backfill on read failed for ${race.slug}`, err);
		return race;
	}
}

/** Recompute elevation for every race saved with 0 m gain (worker start / script). */
export async function backfillMissingElevation(): Promise<number> {
	const rows = await db.select().from(races).where(eq(races.elevationGainM, 0));
	let updated = 0;
	for (const race of rows) {
		try {
			if (await backfillRaceElevation(race)) updated += 1;
		} catch (err) {
			console.error(`Elevation backfill failed for ${race.slug}`, err);
		}
	}
	return updated;
}
