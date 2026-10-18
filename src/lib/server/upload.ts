import { db } from './db';
import { activities, attempts } from './db/schema';
import { eq } from 'drizzle-orm';
import { findSameRun, withActivityIngestion } from './activity-ingestion';
import {
	parseGpxActivity,
	trackFingerprint,
	UploadError,
	MAX_UPLOAD_BYTES
} from '../activity-file';
import { matchActivityToRaces } from './sync';

export type UploadResult =
	| { ok: true; matched: { slug: string; title: string; timeMs: number | null }[] }
	| { ok: false; message: string };

/** Runner GPX upload (#205): validate, store as an activity, run the course matcher. */
export async function ingestUploadedGpx(userId: string, file: File): Promise<UploadResult> {
	if (file.size === 0) return { ok: false, message: 'Choose a GPX file to upload.' };
	if (file.size > MAX_UPLOAD_BYTES)
		return {
			ok: false,
			message:
				'That file is too large (4 MB max). Try trimming it or exporting without extra sensor data.'
		};
	if (/\.fit$/i.test(file.name)) {
		return { ok: false, message: 'FIT files are not supported yet. Export the activity as GPX.' };
	}

	let parsed;
	try {
		parsed = parseGpxActivity(await file.text());
	} catch (err) {
		if (err instanceof UploadError) return { ok: false, message: err.message };
		throw err;
	}

	const hash = await trackFingerprint(parsed);
	return withActivityIngestion(userId, async (database): Promise<UploadResult> => {
		const dupe = await findSameRun(database, userId, parsed.startedAt);
		if (dupe) {
			return { ok: false, message: 'You already have this run on RunAround (uploaded or synced).' };
		}

		const [row] = await database
			.insert(activities)
			.values({
				userId,
				source: 'upload',
				uploadHash: hash,
				sport: 'Run',
				name: parsed.name,
				startedAt: parsed.startedAt,
				distanceM: parsed.distanceM,
				movingTimeS: parsed.elapsedS,
				elapsedTimeS: parsed.elapsedS
			})
			.onConflictDoNothing()
			.returning();
		if (!row) return { ok: false, message: 'You have already uploaded this file.' };

		const matched = await matchActivityToRaces(
			userId,
			row,
			parsed.timed,
			true,
			undefined,
			database
		);
		if (matched.length === 0) {
			// Keep nothing that did not count, so the runner can retry with a better file.
			await database.delete(activities).where(eq(activities.id, row.id));
			return {
				ok: false,
				message:
					"That run didn't match any published course. It needs to cover about 85% of the route."
			};
		}
		return {
			ok: true,
			// Embargoed races (#206) only confirm the match, never the time.
			matched: matched.map(({ slug, title, timeMs, hidden }) => ({
				slug,
				title,
				timeMs: hidden ? null : timeMs
			}))
		};
	});
}

/** Admin removal of an uploaded attempt (and its activity when nothing else uses it). */
export async function removeUploadedAttempt(attemptId: string, raceId?: string): Promise<boolean> {
	const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
	if (!a?.activityId) return false;
	// Only remove an attempt that belongs to the race being edited (#239).
	if (raceId && a.raceId !== raceId) return false;
	const [act] = await db.select().from(activities).where(eq(activities.id, a.activityId)).limit(1);
	if (act?.source !== 'upload') return false;
	await db.delete(attempts).where(eq(attempts.id, attemptId));
	const [other] = await db
		.select({ id: attempts.id })
		.from(attempts)
		.where(eq(attempts.activityId, act.id))
		.limit(1);
	if (!other) await db.delete(activities).where(eq(activities.id, act.id));
	return true;
}
