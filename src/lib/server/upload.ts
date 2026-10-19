import { db } from './db';
import { activities, attempts } from './db/schema';
import { eq } from 'drizzle-orm';
import { findSameRun, withActivityIngestion } from './activity-ingestion';
import {
	parseFitActivity,
	parseGpxActivity,
	trackFingerprint,
	UploadError,
	MAX_UPLOAD_BYTES,
	type ParsedActivity
} from '../activity-file';
import { matchActivityToRaces } from './sync';

export type UploadResult =
	| { ok: true; matched: { slug: string; title: string; timeMs: number | null }[] }
	| { ok: false; message: string };

/** True when the filename or leading bytes identify a FIT activity. */
function isFitFile(file: File, bytes: Uint8Array): boolean {
	if (/\.fit$/i.test(file.name)) return true;
	// Some watches/phones drop the extension; check the `.FIT` header signature.
	return (
		bytes.length >= 12 &&
		bytes[8] === 0x2e &&
		bytes[9] === 0x46 &&
		bytes[10] === 0x49 &&
		bytes[11] === 0x54
	);
}

/** Runner activity upload (#205/#213): validate, store and run the course matcher. */
export async function ingestUploadedActivity(userId: string, file: File): Promise<UploadResult> {
	if (file.size === 0) return { ok: false, message: 'Choose a GPX or FIT file to upload.' };
	if (file.size > MAX_UPLOAD_BYTES)
		return {
			ok: false,
			message:
				'That file is too large (4 MB max). Try trimming it or exporting without extra sensor data.'
		};

	let parsed: ParsedActivity;
	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		parsed = isFitFile(file, bytes)
			? parseFitActivity(bytes, file.name.replace(/\.fit$/i, '') || 'Uploaded run')
			: parseGpxActivity(new TextDecoder().decode(bytes));
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

/** Kept for callers/tests written before FIT support; the pipeline is identical. */
export const ingestUploadedGpx = ingestUploadedActivity;

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
