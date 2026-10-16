import { db, postgresClient } from './db';
import { jobs } from './db/schema';
import type { ActivityDatabase } from './activity-ingestion';

export type JobType = 'backfill' | 'match_activity' | 'send_email' | 'poll_activities' | 'race_end';

export async function enqueueJob(
	type: JobType,
	payload: Record<string, unknown> = {},
	runAt = new Date(),
	database: ActivityDatabase = db
) {
	await database.insert(jobs).values({ type, payload, runAt });
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
		SET status = 'running', attempts = attempts + 1
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
