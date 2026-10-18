import { db, postgresClient } from './db';
import { jobs } from './db/schema';
import type { ActivityDatabase } from './activity-ingestion';

export type JobType =
	| 'backfill'
	| 'match_activity'
	| 'delete_activity'
	| 'send_email'
	| 'poll_activities'
	| 'full_rescan'
	| 'race_end';

export async function enqueueJob(
	type: JobType,
	payload: Record<string, unknown> = {},
	runAt = new Date(),
	database: ActivityDatabase = db
) {
	await database.insert(jobs).values({ type, payload, runAt });
}

/**
 * Schedule a self-rescheduling job (`race_end`, `poll_activities`, `full_rescan`)
 * unless one is already pending. Every worker start and every run re-schedules
 * through here, so duplicate chains left by earlier workers collapse into one
 * instead of multiplying with each deploy.
 */
export async function scheduleRecurringJob(type: JobType, runAt = new Date()) {
	await postgresClient`
		INSERT INTO jobs (type, payload, run_at)
		SELECT ${type}::text, '{}'::jsonb, ${runAt.toISOString()}::timestamptz
		WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE type = ${type} AND status = 'pending')
	`;
}

function asPayload(raw: unknown): Record<string, unknown> {
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as Record<string, unknown>;
	}
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return {};
		}
	}
	return {};
}

export async function claimNextJob() {
	const result = await postgresClient<
		{ id: string; type: string; payload: unknown; status: string }[]
	>`
		UPDATE jobs
		SET status = 'running', attempts = attempts + 1, run_at = NOW()
		WHERE id = (
			SELECT id FROM jobs
			WHERE status = 'pending' AND run_at <= NOW()
			ORDER BY run_at
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		RETURNING id, type, payload, status
	`;
	const row = result[0];
	if (!row) return null;
	return {
		id: String(row.id),
		type: String(row.type),
		payload: asPayload(row.payload)
	};
}

export async function completeJob(id: string) {
	await postgresClient`UPDATE jobs SET status = 'done', last_error = NULL WHERE id = ${id}`;
}

export async function failJob(id: string, error: string, retry = true) {
	if (retry) {
		await postgresClient`
			UPDATE jobs
			SET status = 'pending', last_error = ${error}, run_at = NOW() + INTERVAL '60 seconds'
			WHERE id = ${id}
		`;
		return;
	}
	await postgresClient`UPDATE jobs SET status = 'failed', last_error = ${error} WHERE id = ${id}`;
}

/**
 * Requeue jobs whose worker died between claim and completion (#234). `run_at`
 * doubles as the lease timestamp: `claimNextJob` stamps it when the job starts.
 */
export async function reclaimStuckJobs(olderThanSeconds = 900): Promise<number> {
	const rows = await postgresClient<{ id: string }[]>`
		UPDATE jobs
		SET status = 'pending', run_at = NOW()
		WHERE status = 'running'
			AND run_at < NOW() - (${olderThanSeconds}::int * INTERVAL '1 second')
		RETURNING id
	`;
	return rows.length;
}
