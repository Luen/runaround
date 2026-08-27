import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db';
import { attempts, races } from './db/schema';
import {
	decodePolyline,
	lineStringGeoJSON,
	parseClockToMs,
	parseDmy,
	parseLegacyDate,
	geojsonToGpx
} from '../geo';
import { computeRaceStatus } from '../matching';
import { legacySurface } from '../legacy';
import { eq } from 'drizzle-orm';

type LegacyRace = {
	id: number | string;
	name: string;
	title?: string;
	description?: string;
	distance: number;
	total_elevation_gain: number;
	elevation_profile?: string;
	map?: { polyline?: string };
	duration?: [string, string][];
	leaderboard?: {
		name: string;
		date: string;
		time: string;
		profileID?: string;
		effortURL?: string;
	}[];
};

export async function migrateLegacy(pathToJson?: string) {
	const here = dirname(fileURLToPath(import.meta.url));
	const file = pathToJson ?? resolve(here, '../../../data/legacy/database.json');
	const raw = JSON.parse(readFileSync(file, 'utf8')) as LegacyRace[];

	for (const race of raw) {
		const slug = String(race.id);
		const [existing] = await db.select().from(races).where(eq(races.slug, slug)).limit(1);
		const window = race.duration?.[0] ?? ['1/1/22', '31/12/22'];
		const startsAt = parseDmy(window[0]);
		const endsAt = parseDmy(window[1]);
		endsAt.setUTCHours(23, 59, 59, 999);
		const points = race.map?.polyline ? decodePolyline(race.map.polyline) : [];
		if (points.length < 2) {
			console.warn(`Skipping ${slug}: no polyline`);
			continue;
		}
		const courseGeojson = lineStringGeoJSON(points);
		const title = race.title ?? race.name;
		const surface = legacySurface(slug);
		const values = {
			slug,
			title,
			stravaName: race.name,
			description: race.description ?? '',
			surface,
			startsAt,
			endsAt,
			status: computeRaceStatus(startsAt, endsAt),
			stravaSegmentId: slug,
			courseGeojson,
			gpx: geojsonToGpx(title, courseGeojson),
			distanceM: race.distance,
			elevationGainM: race.total_elevation_gain,
			elevationProfileUrl: race.elevation_profile ?? null
		};

		let raceId = existing?.id;
		if (existing) {
			await db.update(races).set(values).where(eq(races.id, existing.id));
		} else {
			const [inserted] = await db.insert(races).values(values).returning();
			raceId = inserted.id;
		}

		for (const row of race.leaderboard ?? []) {
			const timeMs = parseClockToMs(row.time);
			if (timeMs === null || !raceId) continue;
			const startedAt = parseLegacyDate(row.date) ?? startsAt;
			const athleteId = row.profileID ? String(row.profileID) : null;
			const name = row.name.replace(/\s+/g, ' ').trim();
			if (athleteId) {
				const dup = await db
					.select()
					.from(attempts)
					.where(eq(attempts.stravaAthleteId, athleteId));
				if (dup.some((d) => d.raceId === raceId && d.source === 'strava_import')) continue;
			}
			await db.insert(attempts).values({
				raceId,
				importedName: name,
				stravaAthleteId: athleteId,
				timeMs,
				startedAt,
				matchMethod: 'import',
				coveragePct: 1,
				source: 'strava_import',
				effortUrl: row.effortURL ?? null
			});
		}
	}
}

