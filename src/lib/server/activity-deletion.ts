import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { activities, attempts } from './db/schema';
import { stravaActivityDeleted } from './strava';

/**
 * Remove a runner's Strava activity and its attempts (#233).
 *
 * `attempts.activity_id` is `on delete set null`, so the attempts must be deleted
 * first — otherwise the run would linger on leaderboards with a null activity.
 */
export async function deleteStravaActivity(
	userId: string,
	stravaActivityId: string
): Promise<boolean> {
	const [activity] = await db
		.select()
		.from(activities)
		.where(and(eq(activities.stravaActivityId, stravaActivityId), eq(activities.userId, userId)))
		.limit(1);
	if (!activity) return false;
	await db.delete(attempts).where(eq(attempts.activityId, activity.id));
	await db.delete(activities).where(eq(activities.id, activity.id));
	return true;
}

/**
 * Worker handler for a Strava `delete` webhook event. Strava does not sign webhook
 * events and activity ids are public (leaderboard links), so the event is only a
 * hint: delete only when the runner owns the activity and Strava confirms it is gone.
 */
export async function deleteStravaActivityIfGone(
	userId: string,
	stravaActivityId: string
): Promise<boolean> {
	const [activity] = await db
		.select({ id: activities.id })
		.from(activities)
		.where(and(eq(activities.stravaActivityId, stravaActivityId), eq(activities.userId, userId)))
		.limit(1);
	if (!activity) return false;
	if (!(await stravaActivityDeleted(userId, stravaActivityId))) return false;
	return deleteStravaActivity(userId, stravaActivityId);
}
