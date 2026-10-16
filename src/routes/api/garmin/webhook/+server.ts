import { json, text } from '@sveltejs/kit';
import { garminEnabled, type GarminActivityDetail } from '$lib/garmin';
import { enqueueJob } from '$lib/server/jobs';
import { forgetGarminUser } from '$lib/server/garmin';
import type { RequestHandler } from './$types';

/**
 * Garmin Health/Activity API push endpoint. Configure in the Garmin developer
 * portal as `<ORIGIN>/api/garmin/webhook?secret=<GARMIN_WEBHOOK_SECRET>` for the
 * Activity Details, Deregistration and User Permissions summaries.
 * Garmin expects a fast 200, so matching happens in the worker.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	if (!garminEnabled() || url.searchParams.get('secret') !== process.env.GARMIN_WEBHOOK_SECRET) {
		return text('Forbidden', { status: 403 });
	}
	const body = (await request.json().catch(() => ({}))) as {
		activityDetails?: GarminActivityDetail[];
		deregistrations?: { userId?: string }[];
	};
	for (const detail of body.activityDetails ?? []) {
		await enqueueJob('garmin_activity', { detail });
	}
	for (const d of body.deregistrations ?? []) {
		if (d.userId) await forgetGarminUser(d.userId);
	}
	return json({ ok: true });
};
