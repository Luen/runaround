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
	getActivityStreams: vi.fn(async () => ({
		latlng: {
			data: [
				[-19.3, 146.75],
				[-19.299, 146.75],
				[-19.298, 146.75]
			]
		},
		time: { data: [0, 60, 120] }
	})),
	listActivities: vi.fn()
}));

import { db, postgresClient } from './db';
import { activities, attempts, jobs, races, rankSnapshots, user } from './db/schema';
import { ingestUploadedGpx } from './upload';
import { upsertAndMatchActivity } from './sync';

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
	}
);
