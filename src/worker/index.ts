import { claimNextJob, completeJob, failJob, enqueueJob } from '../lib/server/jobs';
import { backfillUser, sendQueuedEmail, sendRaceEndEmails, upsertAndMatchActivity } from '../lib/server/sync';
import { getActivity, stravaUsers } from '../lib/server/strava';
import { db } from '../lib/server/db';
import { activities } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';

const POLL_MS = 15 * 60_000;
const RACE_END_MS = 60_000;

async function handleJob() {
	const job = await claimNextJob();
	if (!job) return false;
	try {
		if (job.type === 'backfill') {
			await backfillUser(String(job.payload.userId));
		} else if (job.type === 'match_activity') {
			const userId = String(job.payload.userId);
			const activityId = String(job.payload.activityId);
			const [existing] = await db
				.select()
				.from(activities)
				.where(eq(activities.stravaActivityId, activityId))
				.limit(1);
			const detailed = await getActivity(userId, activityId);
			await upsertAndMatchActivity(userId, detailed ?? (existing as never));
		} else if (job.type === 'send_email') {
			const result = await sendQueuedEmail(job.payload);
			if (result && 'retry' in result && result.retry) {
				await failJob(job.id, result.error, true);
				return true;
			}
		} else if (job.type === 'race_end') {
			await sendRaceEndEmails();
			await enqueueJob('race_end', {}, new Date(Date.now() + RACE_END_MS));
		} else if (job.type === 'poll_activities') {
			const users = await stravaUsers();
			for (const u of users) {
				await enqueueJob('backfill', { userId: u.id });
			}
			await enqueueJob('poll_activities', {}, new Date(Date.now() + POLL_MS));
		}
		await completeJob(job.id);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const retry = message === 'STRAVA_RATE_LIMIT' || /429|5\d\d/.test(message);
		await failJob(job.id, message, retry);
	}
	return true;
}

async function loop() {
	console.log('RunAround worker started');
	await enqueueJob('race_end', {});
	await enqueueJob('poll_activities', {}, new Date(Date.now() + POLL_MS));
	for (;;) {
		const did = await handleJob();
		if (!did) {
			await new Promise((r) => setTimeout(r, 2000));
		}
	}
}

loop().catch((err) => {
	console.error(err);
	process.exit(1);
});
