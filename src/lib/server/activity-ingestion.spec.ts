import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, sql } from 'drizzle-orm';

// Never read the app's POSTGRES_URL or .env in database tests.
vi.mock('./db', async () => {
	const { default: postgres } = await import('postgres');
	const { drizzle } = await import('drizzle-orm/postgres-js');
	const schema = await import('./db/schema');
	const configured = process.env.RUNAROUND_TEST_POSTGRES_URL;
	if (configured && !new URL(configured).pathname.endsWith('/runaround_test')) {
		throw new Error('Integration tests require a dedicated runaround_test database');
	}
	const postgresClient = postgres(configured ?? 'postgres://unused@127.0.0.1:1/runaround_test');
	return { postgresClient, db: drizzle(postgresClient, { schema }) };
});
vi.mock('./strava', () => ({
	getActivity: vi.fn(async () => null),
	getActivityStreams: vi.fn(
		async (): Promise<{
			latlng?: { data: [number, number][] };
			time?: { data: number[] };
		} | null> => ({
			latlng: {
				data: [
					[-19.3, 146.75],
					[-19.299, 146.75],
					[-19.298, 146.75]
				]
			},
			time: { data: [0, 60, 120] }
		})
	),
	listActivities: vi.fn(),
	stravaActivityDeleted: vi.fn(async () => true)
}));

import { db, postgresClient } from './db';
import { activities, attempts, jobs, races, rankSnapshots, user } from './db/schema';
import { ingestUploadedGpx } from './upload';
import { backfillUser, upsertAndMatchActivity } from './sync';
import { getActivityStreams, listActivities, stravaActivityDeleted } from './strava';
import { deleteStravaActivityIfGone } from './activity-deletion';
import { claimNextJob, enqueueJob, reclaimStuckJobs, scheduleRecurringJob } from './jobs';

const start = new Date('2026-01-01T00:00:00Z');
const strava = {
	id: 100,
	name: 'Run',
	type: 'Run',
	start_date: start.toISOString(),
	distance: 220,
	moving_time: 120,
	elapsed_time: 120
};
const file = () =>
	new File(
		[
			`<gpx><trk><trkseg>${[-19.3, -19.299, -19.298].map((lat, i) => `<trkpt lat="${lat}" lon="146.75"><time>${new Date(+start + i * 60_000).toISOString()}</time></trkpt>`).join('')}</trkseg></trk></gpx>`
		],
		'run.gpx'
	);

describe.skipIf(!process.env.RUNAROUND_TEST_POSTGRES_URL)(
	'transactional activity ingestion (Postgres)',
	() => {
		beforeAll(async () => {
			await migrate(db, { migrationsFolder: 'drizzle' });
		});
		beforeEach(async () => {
			await db.execute(sql`drop trigger if exists reject_test_job on jobs`);
			await db.execute(sql`truncate table "user", races, jobs cascade`);
			await db
				.insert(user)
				.values({ id: 'runner', name: 'Runner', email: 'runner@example.test', needsEmail: false });
			await db.insert(races).values({
				slug: 'test',
				title: 'Test',
				surface: 'trail',
				status: 'live',
				startsAt: new Date('2025-01-01'),
				endsAt: new Date('2028-01-01'),
				courseGeojson: {
					type: 'LineString',
					coordinates: [
						[146.75, -19.3],
						[146.75, -19.299],
						[146.75, -19.298]
					]
				}
			});
		});
		afterAll(async () => {
			await postgresClient.end();
		});

		it('deduplicates upload then Strava', async () => {
			expect((await ingestUploadedGpx('runner', file())).ok).toBe(true);
			await upsertAndMatchActivity('runner', strava);
			expect(await db.select().from(activities)).toHaveLength(1);
			expect(await db.select().from(attempts)).toHaveLength(1);
		});
		it('deduplicates Strava then upload', async () => {
			await upsertAndMatchActivity('runner', strava);
			expect((await ingestUploadedGpx('runner', file())).ok).toBe(false);
			expect(await db.select().from(activities)).toHaveLength(1);
			expect(await db.select().from(attempts)).toHaveLength(1);
		});
		it('serializes concurrent sources for the same runner', async () => {
			await Promise.all([
				ingestUploadedGpx('runner', file()),
				upsertAndMatchActivity('runner', strava)
			]);
			expect(await db.select().from(activities)).toHaveLength(1);
			expect(await db.select().from(attempts)).toHaveLength(1);
		});
		it('rolls back attempts and activity when notification enqueue fails, then allows retry', async () => {
			const [race] = await db.select().from(races);
			await db
				.insert(rankSnapshots)
				.values({ userId: 'runner', raceId: race.id, board: 'race', rank: 5, notifiedRank: 5 });
			await db.execute(
				sql`create or replace function reject_test_job() returns trigger language plpgsql as $$ begin raise exception 'injected enqueue failure'; end $$`
			);
			await db.execute(
				sql`create trigger reject_test_job before insert on jobs for each row execute function reject_test_job()`
			);
			await expect(ingestUploadedGpx('runner', file())).rejects.toThrow();
			expect(await db.select().from(activities)).toHaveLength(0);
			expect(await db.select().from(attempts)).toHaveLength(0);
			expect(await db.select().from(jobs)).toHaveLength(0);
			expect((await db.select().from(rankSnapshots))[0].rank).toBe(5);
			await db.execute(sql`drop trigger reject_test_job on jobs`);
			expect((await ingestUploadedGpx('runner', file())).ok).toBe(true);
			expect(await db.select().from(attempts)).toHaveLength(1);
			expect(await db.select().from(jobs)).toHaveLength(1);
		});
		it('does not retain unmatched uploads', async () => {
			await db.delete(races);
			expect((await ingestUploadedGpx('runner', file())).ok).toBe(false);
			expect(await db.select().from(activities)).toHaveLength(0);
		});
		it('allows a different outing for the same runner', async () => {
			await upsertAndMatchActivity('runner', strava);
			await upsertAndMatchActivity('runner', {
				...strava,
				id: 101,
				start_date: new Date(+start + 3_600_000).toISOString()
			});
			expect(await db.select().from(activities)).toHaveLength(2);
			expect(await db.select().from(attempts).where(eq(attempts.userId, 'runner'))).toHaveLength(2);
		});
		it('ignores an activity outside the race window (#222)', async () => {
			await upsertAndMatchActivity('runner', {
				...strava,
				id: 102,
				start_date: '2020-01-01T00:00:00Z'
			});
			expect(await db.select().from(activities)).toHaveLength(1);
			expect(await db.select().from(attempts)).toHaveLength(0);
		});
		it('does not time an activity with no time stream (#223)', async () => {
			vi.mocked(getActivityStreams).mockResolvedValueOnce({
				latlng: {
					data: [
						[-19.3, 146.75],
						[-19.299, 146.75],
						[-19.298, 146.75]
					]
				}
			});
			await upsertAndMatchActivity('runner', strava);
			expect(await db.select().from(attempts)).toHaveLength(0);
		});
		it('removes a deleted Strava activity only when Strava confirms it (#233)', async () => {
			await upsertAndMatchActivity('runner', strava);
			expect(await db.select().from(attempts)).toHaveLength(1);
			// A forged event for someone else's activity, or one Strava still serves, is ignored.
			expect(await deleteStravaActivityIfGone('someone-else', '100')).toBe(false);
			vi.mocked(stravaActivityDeleted).mockResolvedValueOnce(false);
			expect(await deleteStravaActivityIfGone('runner', '100')).toBe(false);
			expect(await db.select().from(attempts)).toHaveLength(1);
			expect(await deleteStravaActivityIfGone('runner', '100')).toBe(true);
			expect(await db.select().from(activities)).toHaveLength(0);
			expect(await db.select().from(attempts)).toHaveLength(0);
			expect(await deleteStravaActivityIfGone('runner', '100')).toBe(false);
		});
		it('skips Strava detail/stream calls for runs outside every race window (#225)', async () => {
			vi.mocked(getActivityStreams).mockClear();
			await upsertAndMatchActivity('runner', {
				...strava,
				id: 103,
				start_date: '2020-01-01T00:00:00Z'
			});
			expect(getActivityStreams).not.toHaveBeenCalled();
			expect(await db.select().from(activities)).toHaveLength(1);
		});
		it('uses only Strava activities for the incremental watermark (#225)', async () => {
			await upsertAndMatchActivity('runner', strava);
			await db.insert(activities).values({
				userId: 'runner',
				source: 'upload',
				startedAt: new Date('2026-06-01T00:00:00Z')
			});
			vi.mocked(listActivities).mockResolvedValueOnce([]);
			await backfillUser('runner');
			expect(listActivities).toHaveBeenLastCalledWith('runner', 1, 50, +start / 1000);
		});
		it('keeps a single pending copy of each recurring job', async () => {
			await scheduleRecurringJob('race_end');
			await scheduleRecurringJob('race_end');
			await scheduleRecurringJob('poll_activities');
			const rows = await db.select().from(jobs);
			expect(rows.filter((j) => j.type === 'race_end')).toHaveLength(1);
			expect(rows.filter((j) => j.type === 'poll_activities')).toHaveLength(1);
		});
		it('requeues jobs left running by a dead worker (#234)', async () => {
			await enqueueJob('backfill', { userId: 'runner' });
			expect(await claimNextJob()).not.toBeNull();
			// A fresh lease is not reclaimed...
			expect(await reclaimStuckJobs(900)).toBe(0);
			// ...but a lease older than the threshold is put back to pending.
			await db.execute(sql`update jobs set run_at = NOW() - INTERVAL '1 hour'`);
			expect(await reclaimStuckJobs(900)).toBe(1);
			expect((await db.select().from(jobs))[0].status).toBe('pending');
		});
	}
);
