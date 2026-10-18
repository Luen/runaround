import {
	claimNextJob,
	completeJob,
	failJob,
	enqueueJob,
	reclaimStuckJobs,
	scheduleRecurringJob
} from '../lib/server/jobs';
import {
	backfillUser,
	refreshRaceStatuses,
	sendQueuedEmail,
	sendRaceEndEmails,
	syncActivityById
} from '../lib/server/sync';
import { stravaUsers } from '../lib/server/strava';
import { assertDatabaseConfigured } from '../lib/server/db';
import { backfillMissingElevation } from '../lib/server/elevation-backfill';
import { deleteStravaActivityIfGone } from '../lib/server/activity-deletion';

const POLL_MS = 15 * 60_000;
const RACE_END_MS = 60_000;
const FULL_RESCAN_MS = 24 * 60 * 60_000;

async function handleJob() {
	const job = await claimNextJob();
	if (!job) return false;
	try {
		if (job.type === 'backfill') {
			await backfillUser(String(job.payload.userId), { full: job.payload.full === true });
		} else if (job.type === 'match_activity') {
			await syncActivityById(String(job.payload.userId), String(job.payload.activityId));
		} else if (job.type === 'delete_activity') {
			await deleteStravaActivityIfGone(String(job.payload.userId), String(job.payload.activityId));
		} else if (job.type === 'send_email') {
			const result = await sendQueuedEmail(job.payload);
			if (result && 'retry' in result && result.retry) {
				await failJob(job.id, result.error, true);
				return true;
			}
		} else if (job.type === 'race_end') {
			// Keep stored status (upcoming → live → closed) fresh, then email finishers.
			await refreshRaceStatuses();
			await sendRaceEndEmails();
			await scheduleRecurringJob('race_end', new Date(Date.now() + RACE_END_MS));
		} else if (job.type === 'poll_activities') {
			// Incremental: only activities newer than the last stored one (#225).
			const users = await stravaUsers();
			for (const u of users) {
				await enqueueJob('backfill', { userId: u.id });
			}
			await scheduleRecurringJob('poll_activities', new Date(Date.now() + POLL_MS));
		} else if (job.type === 'full_rescan') {
			// Daily full history re-read so new races can match older runs (#225).
			const users = await stravaUsers();
			for (const u of users) {
				await enqueueJob('backfill', { userId: u.id, full: true });
			}
			await scheduleRecurringJob('full_rescan', new Date(Date.now() + FULL_RESCAN_MS));
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
	assertDatabaseConfigured();
	console.log('RunAround worker started');
	// Recover jobs a previous (crashed) worker left mid-flight (#234).
	const reclaimed = await reclaimStuckJobs();
	if (reclaimed) console.log(`Requeued ${reclaimed} stuck job(s)`);
	backfillMissingElevation()
		.then((n) => n && console.log(`Elevation backfilled for ${n} race(s)`))
		.catch((err) => console.error('Elevation backfill failed', err));
	await scheduleRecurringJob('race_end');
	await scheduleRecurringJob('full_rescan');
	await scheduleRecurringJob('poll_activities', new Date(Date.now() + POLL_MS));
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
