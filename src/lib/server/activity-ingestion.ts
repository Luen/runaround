import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from './db';
import { activities } from './db/schema';

export type ActivityDatabase = Pick<
	typeof db,
	'select' | 'insert' | 'update' | 'delete' | 'execute'
>;

/** Serialize all sources for a runner; roll back activities, attempts and jobs together. */
export function withActivityIngestion<T>(
	userId: string,
	work: (tx: ActivityDatabase) => Promise<T>
) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
		return work(tx);
	});
}

/** Same-run protection is shared by every ingestion source and runs under the runner lock. */
export async function findSameRun(database: ActivityDatabase, userId: string, startedAt: Date) {
	const [row] = await database
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.userId, userId),
				gte(activities.startedAt, new Date(startedAt.getTime() - 60_000)),
				lte(activities.startedAt, new Date(startedAt.getTime() + 60_000))
			)
		)
		.limit(1);
	return row;
}
