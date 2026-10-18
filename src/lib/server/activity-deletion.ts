import { eq } from 'drizzle-orm';
import { db } from './db';
import { activities, attempts } from './db/schema';

/**
 * Remove a Strava activity and its attempts when Strava reports a delete (#233).
 *
 * `attempts.activity_id` is `on delete set null`, so the attempts must be deleted
 * first — otherwise the run would linger on leaderboards with a null activity.
 */
export async function deleteStravaActivity(stravaActivityId: string): Promise<boolean> {
	const [activity] = await db
		.select()
		.from(activities)
		.where(eq(activities.stravaActivityId, stravaActivityId))
		.limit(1);
	if (!activity) return false;
	await db.delete(attempts).where(eq(attempts.activityId, activity.id));
	await db.delete(activities).where(eq(activities.id, activity.id));
	return true;
}
