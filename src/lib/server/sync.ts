import { db } from './db';
import { activities, attempts, emailSuppressions, races, rankSnapshots, user } from './db/schema';
import { getActivity, getActivityStreams, listActivities } from './strava';
import { matchActivityToCourse, rankImproved } from '../matching';
import { decodePolyline, pointsFromLineString, type LngLat } from '../geo';
import type { TimedPoint } from '../matching';
import { overallLeaderboard, raceLeaderboard } from './leaderboard';
import { enqueueJob } from './jobs';
import { positionGainedEmail, raceEndedEmail, sendEmail } from './email';
import { formatDuration } from '../geo';
import { and, eq } from 'drizzle-orm';
import { isPlaceholderEmail } from './identity';

const RUN_SPORTS = new Set(['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike']);

function origin(): string {
	return process.env.ORIGIN ?? 'http://localhost:5173';
}

export async function backfillUser(userId: string) {
	for (let page = 1; page <= 20; page += 1) {
		const batch = await listActivities(userId, page, 50);
		if (batch.length === 0) break;
		for (const activity of batch) {
			await upsertAndMatchActivity(userId, activity);
		}
		if (batch.length < 50) break;
	}
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

	const [existing] = await db
		.select()
		.from(activities)
		.where(eq(activities.stravaActivityId, String(activity.id)))
		.limit(1);

	let activityRow = existing;
	if (!activityRow) {
		const [inserted] = await db
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

	const detailed = await getActivity(userId, String(activity.id));
	const streams = await getActivityStreams(userId, String(activity.id));
	await db
		.update(activities)
		.set({ streamFetchedAt: new Date() })
		.where(eq(activities.id, activityRow.id));

	const timed = streamsToTimed(streams, activityRow.summaryPolyline);
	const published = await db.select().from(races);

	for (const race of published) {
		if (race.status === 'draft') continue;
		let method: 'gps' | 'segment_effort' | null = null;
		let timeMs: number | null = null;
		let coverage: number | null = null;

		const segmentId = race.stravaSegmentId ? Number(race.stravaSegmentId) : null;
		const effort = detailed?.segment_efforts?.find((e) => e.segment?.id === segmentId);
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

		const [prior] = await db
			.select()
			.from(attempts)
			.where(and(eq(attempts.raceId, race.id), eq(attempts.activityId, activityRow.id)))
			.limit(1);

		if (prior) {
			await db
				.update(attempts)
				.set({ timeMs, matchMethod: method, coveragePct: coverage })
				.where(eq(attempts.id, prior.id));
		} else {
			const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
			await db.insert(attempts).values({
				raceId: race.id,
				userId,
				activityId: activityRow.id,
				importedName: u?.name ?? 'Runner',
				stravaAthleteId: u?.stravaAthleteId ?? null,
				timeMs,
				startedAt: activityRow.startedAt,
				matchMethod: method,
				coveragePct: coverage,
				source: 'live'
			});
		}

		await maybeNotifyRankGain(userId, race);
	}
}

function streamsToTimed(
	streams: Awaited<ReturnType<typeof getActivityStreams>>,
	summaryPolyline: string | null
): TimedPoint[] {
	if (streams?.latlng?.data?.length) {
		const times = streams.time?.data ?? streams.latlng.data.map((_, i) => i);
		return streams.latlng.data.map(([lat, lng], i) => ({
			point: { lat, lng } satisfies LngLat,
			t: times[i] ?? i
		}));
	}
	if (summaryPolyline) {
		const pts = decodePolyline(summaryPolyline);
		return pts.map((point, i) => ({ point, t: i }));
	}
	return [];
}

async function maybeNotifyRankGain(userId: string, race: typeof races.$inferSelect) {
	for (const board of ['race', 'overall'] as const) {
		const rows =
			board === 'race' ? await raceLeaderboard(race.id) : await overallLeaderboard(race.id);
		const rank = rows.find((r) => r.userId === userId)?.rank;
		if (!rank) continue;

		const [snap] = await db
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
			await db.insert(rankSnapshots).values({
				userId,
				raceId: race.id,
				board,
				rank,
				notifiedRank: rank
			});
		} else {
			await db
				.update(rankSnapshots)
				.set({ rank, updatedAt: new Date() })
				.where(eq(rankSnapshots.id, snap.id));
		}

		if (!shouldEmail) continue;

		await enqueueJob('send_email', {
			kind: 'position_gained',
			userId,
			raceId: race.id,
			board,
			oldRank: previous,
			newRank: rank
		});
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
		if (!race) return { skip: true as const };
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

export async function sendRaceEndEmails() {
	const now = new Date();
	const all = await db.select().from(races);
	for (const race of all) {
		if (race.endsAt > now || race.raceEndEmailsSentAt) continue;
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
