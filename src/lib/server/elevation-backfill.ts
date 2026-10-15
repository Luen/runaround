import { eq } from 'drizzle-orm';
import { db } from './db';
import { races } from './db/schema';
import { geojsonToGpx } from '../geo';
import { courseElevation } from './elevation';

/** Recompute elevation for races saved with 0 m gain (e.g. GPX uploaded without <ele>). */
export async function backfillMissingElevation(): Promise<number> {
	const rows = await db.select().from(races).where(eq(races.elevationGainM, 0));
	let updated = 0;
	for (const race of rows) {
		try {
			const xml = race.gpx ?? geojsonToGpx(race.title, race.courseGeojson);
			const { elevations, elevationGainM } = await courseElevation(xml, race.courseGeojson);
			if (elevationGainM <= 0) continue;
			await db
				.update(races)
				.set({
					elevationGainM,
					gpx: geojsonToGpx(race.title, race.courseGeojson, elevations),
					updatedAt: new Date()
				})
				.where(eq(races.id, race.id));
			updated += 1;
		} catch (err) {
			console.error(`Elevation backfill failed for ${race.slug}`, err);
		}
	}
	return updated;
}
