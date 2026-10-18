import { siteOrigin } from '../origin';
import { db } from './db';
import { activities, attempts, emailSuppressions, races, rankSnapshots, user } from './db/schema';
import { getActivity, getActivityStreams, listActivities } from './strava';
import {
	matchActivityToCourse,
	courseEffortPoints,
	rankImproved,
	inRaceWindow,
	timedPointsFromStreams,
	effectiveRaceStatus
} from '../matching';
import { downsampleTrace, type TracePoint } from '../teams';
import { pointsFromLineString } from '../geo';
import type { TimedPoint } from '../matching';
import { overallLeaderboard, raceLeaderboard } from './leaderboard';
import { enqueueJob } from './jobs';
import { positionGainedEmail, raceEndedEmail, sendEmail } from './email';
import { formatDuration } from '../geo';
import { and, desc, eq } from 'drizzle-orm';
import { isPlaceholderEmail } from './identity';
import { resultsHidden } from '../reveal';
import { findSameRun, withActivityIngestion, type ActivityDatabase } from './activity-ingestion';

const RUN_SPORTS = new Set(['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike']);

function origin(): string {
	return siteOrigin(process.env.ORIGIN, 'https://runaround.com.au');
}

/**
 * Sync a runner's Strava activities into RunAround.
 *
 * Incremental by default (#225): only activities newer than the latest stored one
 * are fetched, so the 15-minute poll is a handful of API calls, not a full history
 * re-download. `full: true` (the daily rescan) re-reads everything so a newly
 * created race can still match older runs.
 */
export async function backfillUser(userId: string, options: { full?: boolean } = {}) {
	let after: number | undefined;
	if (!options.full) {
		const [latest] = await db
			.select({ startedAt: activities.startedAt })
			.from(activities)
			// Strava only: a newer upload/Garmin run must not hide unsynced Strava runs.
			.where(and(eq(activities.userId, userId), eq(activities.source, 'strava')))
			.orderBy(desc(activities.startedAt))
			.limit(1);
		if (latest?.startedAt) after = Math.floor(latest.startedAt.getTime() / 1000);
	}

	for (let page = 1; page <= 20; page += 1) {
		const batch = await listActivities(userId, page, 50, after);
		if (batch.length === 0) break;
		for (const activity of batch) {
			await upsertAndMatchActivity(userId, activity);
		}
		if (batch.length < 50) break;
	}
}

/** Fetch one activity's detail once, then store and match it (webhook path, #225). */
export async function syncActivityById(userId: string, activityId: string) {
	const detailed = await getActivity(userId, activityId);
	if (detailed) await upsertAndMatchActivity(userId, detailed);
}

export async function upsertAndMatchActivity(
	userId: string,
	activity:
		| Awaited<ReturnType<typeof getActivity>>
		| NonNullable<Awaited<ReturnType<typeof listActivities>>>[number]
) {
	if (!activity) return;
	const sport = activity.sport_type ?? activity.type;
	if (!RUN_SPORTS.has(sport) && activity.type !== 'Run') return;

	// Only a run inside some published race window can become an attempt (#222), so
	// skip both provider calls for every other run. Otherwise the daily full rescan
	// re-downloads detail + streams for a runner's whole history and exhausts the
	// Strava rate limit (#225). The summary row is still stored for the watermark.
	const startedAt = new Date(activity.start_date);
	const windows = await db
		.select({ status: races.status, startsAt: races.startsAt, endsAt: races.endsAt })
		.from(races);
	const matchable = windows.some(
		(r) => r.status !== 'draft' && inRaceWindow(startedAt, r.startsAt, r.endsAt)
	);

	// Fetch provider data before taking the database lock. A payload from
	// getActivity already carries segment efforts, so we skip the duplicate detail
	// call that the webhook used to make (#225).
	const detailed = !matchable
		? null
		: Array.isArray(activity.segment_efforts)
			? activity
			: await getActivity(userId, String(activity.id));
	const streams = matchable ? await getActivityStreams(userId, String(activity.id)) : null;
	return withActivityIngestion(userId, async (database) => {
		const [existing] = await database
			.select()
			.from(activities)
			.where(eq(activities.stravaActivityId, String(activity.id)))
			.limit(1);

		let activityRow = existing;
		if (!activityRow && (await findSameRun(database, userId, new Date(activity.start_date))))
			return;
		if (!activityRow) {
			const [inserted] = await database
				.insert(activities)
				.values({
					userId,
					stravaActivityId: String(activity.id),
					sport,
					name: activity.name,
					startedAt: new Date(activity.start_date),
					distanceM: activity.distance,
					movingTimeS: activity.moving_time,
					elapsedTimeS: activity.elapsed_time,
					summaryPolyline: activity.map?.summary_polyline ?? null
				})
				.returning();
			activityRow = inserted;
		}

		if (!matchable) return;
		await database
			.update(activities)
			.set({ streamFetchedAt: new Date() })
			.where(eq(activities.id, activityRow.id));

		const { timed, hasTime } = streamsToTimed(streams);
		await matchActivityToRaces(
			userId,
			activityRow,
			timed,
			hasTime,
			detailed?.segment_efforts,
			database
		);
	});
}

/**
 * Match one stored activity against every published race and upsert attempts.
 * Shared by Strava sync, manual uploads (#205) and other sources. `timed[].t` is
 * seconds from `activityRow.startedAt`; `hasTime` says whether those are real.
 */
export async function matchActivityToRaces(
	userId: string,
	activityRow: typeof activities.$inferSelect,
	timed: TimedPoint[],
	hasTime: boolean,
	segmentEfforts?: { segment?: { id: number }; elapsed_time: number }[],
	database: ActivityDatabase = db
) {
	const published = await database.select().from(races);
	const matched: {
		id: string;
		slug: string;
		title: string;
		timeMs: number;
		hidden: boolean;
	}[] = [];

	for (const race of published) {
		if (race.status === 'draft') continue;
		// A run outside the race window is never a race attempt (#222). Without this a
		// 2020 run over the course shows up (and emails) on a race created in 2026.
		if (!inRaceWindow(activityRow.startedAt, race.startsAt, race.endsAt)) continue;
		let method: 'gps' | 'segment_effort' | null = null;
		let timeMs: number | null = null;
		let coverage: number | null = null;

		const segmentId = race.stravaSegmentId ? Number(race.stravaSegmentId) : null;
		const effort = segmentEfforts?.find((e) => e.segment?.id === segmentId);
		if (effort) {
			method = 'segment_effort';
			timeMs = effort.elapsed_time * 1000;
			coverage = 1;
		} else if (timed.length >= 2) {
			const match = matchActivityToCourse({
				course: pointsFromLineString(race.courseGeojson),
				activity: timed,
				surface: race.surface
			});
			if (match.ok) {
				method = 'gps';
				timeMs = match.timeMs;
				coverage = match.coverage;
			}
		}

		if (!method || timeMs === null) continue;

		// On-course trace with real timestamps, for team linking (#207).
		const trace: TracePoint[] | null = hasTime
			? downsampleTrace(
					courseEffortPoints(timed, pointsFromLineString(race.courseGeojson), race.surface).map(
						(p) => [activityRow.startedAt.getTime() + p.t * 1000, p.point.lat, p.point.lng]
					)
				)
			: null;

		const [prior] = await database
			.select()
			.from(attempts)
			.where(and(eq(attempts.raceId, race.id), eq(attempts.activityId, activityRow.id)))
			.limit(1);

		if (prior) {
			await database
				.update(attempts)
				.set({ timeMs, matchMethod: method, coveragePct: coverage, trace })
				.where(eq(attempts.id, prior.id));
		} else {
			const [u] = await database.select().from(user).where(eq(user.id, userId)).limit(1);
			await database.insert(attempts).values({
				raceId: race.id,
				userId,
				activityId: activityRow.id,
				importedName: u?.name ?? 'Runner',
				stravaAthleteId: u?.stravaAthleteId ?? null,
				timeMs,
				startedAt: activityRow.startedAt,
				matchMethod: method,
				coveragePct: coverage,
				source: 'live',
				trace
			});
		}

		matched.push({
			id: race.id,
			slug: race.slug,
			title: race.title,
			timeMs,
			hidden: resultsHidden(race)
		});
		await maybeNotifyRankGain(userId, race, database);
	}
	return matched;
}

/**
 * Convert Strava streams to timed points. Both `latlng` and `time` are required: a
 * summary polyline has no timestamps, and indexing it produced bogus times (#223).
 */
function streamsToTimed(streams: Awaited<ReturnType<typeof getActivityStreams>>): {
	timed: TimedPoint[];
	hasTime: boolean;
} {
	return timedPointsFromStreams(streams?.latlng?.data, streams?.time?.data);
}

async function maybeNotifyRankGain(
	userId: string,
	race: typeof races.$inferSelect,
	database: ActivityDatabase
) {
	// Embargoed (#206): a "you moved up" email would reveal places early.
	if (resultsHidden(race)) return;
	for (const board of ['race', 'overall'] as const) {
		const rows =
			board === 'race'
				? await raceLeaderboard(race.id, database)
				: await overallLeaderboard(race.id, database);
		const rank = rows.find((r) => r.userId === userId)?.rank;
		if (!rank) continue;

		const [snap] = await database
			.select()
			.from(rankSnapshots)
			.where(
				and(
					eq(rankSnapshots.userId, userId),
					eq(rankSnapshots.raceId, race.id),
					eq(rankSnapshots.board, board)
				)
			)
			.limit(1);

		const previous = snap?.notifiedRank ?? null;
		const shouldEmail = rankImproved(previous, rank);

		if (!snap) {
			await database.insert(rankSnapshots).values({
				userId,
				raceId: race.id,
				board,
				rank,
				notifiedRank: rank
			});
		} else {
			await database
				.update(rankSnapshots)
				.set({ rank, updatedAt: new Date() })
				.where(eq(rankSnapshots.id, snap.id));
		}

		if (!shouldEmail) continue;

		await enqueueJob(
			'send_email',
			{
				kind: 'position_gained',
				userId,
				raceId: race.id,
				board,
				oldRank: previous,
				newRank: rank
			},
			new Date(),
			database
		);
	}
}

export async function sendQueuedEmail(payload: Record<string, unknown>) {
	const kind = payload.kind as string;
	const userId = String(payload.userId);
	const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
	if (!u?.email || u.needsEmail || isPlaceholderEmail(u.email)) {
		return { skip: true as const };
	}

	const [suppressed] = await db
		.select()
		.from(emailSuppressions)
		.where(eq(emailSuppressions.email, u.email.toLowerCase()))
		.limit(1);
	if (suppressed) return { skip: true as const };

	if (kind === 'position_gained') {
		const raceId = String(payload.raceId);
		const board = payload.board as 'race' | 'overall';
		const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
		if (!race || resultsHidden(race)) return { skip: true as const };
		const [snap] = await db
			.select()
			.from(rankSnapshots)
			.where(
				and(
					eq(rankSnapshots.userId, userId),
					eq(rankSnapshots.raceId, raceId),
					eq(rankSnapshots.board, board)
				)
			)
			.limit(1);
		if (
			snap?.notifiedRank !== null &&
			snap?.notifiedRank !== undefined &&
			snap.notifiedRank <= Number(payload.newRank)
		) {
			return { skip: true as const };
		}
		const content = positionGainedEmail({
			name: u.name,
			raceTitle: race.title,
			board,
			oldRank: typeof payload.oldRank === 'number' ? payload.oldRank : null,
			newRank: Number(payload.newRank),
			url: `${origin()}/races/${race.slug}`
		});
		const result = await sendEmail({ to: u.email, ...content });
		if (result.ok) {
			await db
				.update(rankSnapshots)
				.set({ notifiedRank: Number(payload.newRank), rank: Number(payload.newRank) })
				.where(
					and(
						eq(rankSnapshots.userId, userId),
						eq(rankSnapshots.raceId, raceId),
						eq(rankSnapshots.board, board)
					)
				);
			return { sent: true as const };
		}
		if (result.suppressed) {
			await db
				.insert(emailSuppressions)
				.values({ email: u.email.toLowerCase(), reason: result.error })
				.onConflictDoNothing();
			return { skip: true as const };
		}
		return result;
	}

	if (kind === 'race_ended') {
		const raceId = String(payload.raceId);
		const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
		if (!race) return { skip: true as const };
		const content = raceEndedEmail({
			name: u.name,
			raceTitle: race.title,
			rank: Number(payload.rank),
			time: String(payload.time),
			url: `${origin()}/races/${race.slug}`
		});
		const result = await sendEmail({ to: u.email, ...content });
		if (result.ok) return { sent: true as const };
		if (result.suppressed) {
			await db
				.insert(emailSuppressions)
				.values({ email: u.email.toLowerCase(), reason: result.error })
				.onConflictDoNothing();
			return { skip: true as const };
		}
		return result;
	}

	return { skip: true as const };
}

/** Persist upcoming → live → closed so stored status stops going stale (#221). */
export async function refreshRaceStatuses(now = new Date()) {
	const all = await db.select().from(races);
	for (const race of all) {
		const status = effectiveRaceStatus(race, now);
		if (status !== race.status) {
			await db.update(races).set({ status, updatedAt: now }).where(eq(races.id, race.id));
		}
	}
}

export async function sendRaceEndEmails() {
	const now = new Date();
	const all = await db.select().from(races);
	for (const race of all) {
		if (race.endsAt >= now) continue;
		// A draft is unpublished; never force it closed or email it (#237).
		if (race.status === 'draft') continue;
		// Race lifecycle is independent of the results/email embargo.
		if (race.status !== 'closed') {
			await db.update(races).set({ status: 'closed' }).where(eq(races.id, race.id));
		}
		if (race.raceEndEmailsSentAt) continue;
		// Embargoed races send their final-place emails at the reveal instead.
		if (resultsHidden(race, now)) continue;
		const board = await raceLeaderboard(race.id);
		for (const row of board) {
			if (!row.userId) continue;
			await enqueueJob('send_email', {
				kind: 'race_ended',
				userId: row.userId,
				raceId: race.id,
				rank: row.rank,
				time: formatDuration(row.timeMs)
			});
		}
		await db
			.update(races)
			.set({ raceEndEmailsSentAt: now, status: 'closed' })
			.where(eq(races.id, race.id));
	}
}

export { computeRaceStatus } from '../matching';
