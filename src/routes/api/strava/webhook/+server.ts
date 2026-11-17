import { json, text } from '@sveltejs/kit';
import { parseStravaWebhookBody } from '#lib/strava-id.js';
import { enqueueJob } from '#lib/server/jobs.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const challenge = url.searchParams.get('hub.challenge');
	const verify = url.searchParams.get('hub.verify_token');
	const mode = url.searchParams.get('hub.mode');
	if (mode === 'subscribe' && verify === process.env.STRAVA_VERIFY_TOKEN && challenge) {
		return json({ 'hub.challenge': challenge });
	}
	return text('Forbidden', { status: 403 });
};

export const POST: RequestHandler = async ({ request }) => {
	// Parsed from the raw body: webhook ids are bare JSON numbers with no
	// `id_str`, so JSON.parse would round ids above 2^53 (#298).
	const body = parseStravaWebhookBody(await request.text());
	if (
		body.object_type === 'activity' &&
		body.object_id &&
		(body.aspect_type === 'create' ||
			body.aspect_type === 'update' ||
			body.aspect_type === 'delete')
	) {
		const { db } = await import('#lib/server/db/index.js');
		const { user } = await import('#lib/server/db/schema.js');
		const { eq } = await import('drizzle-orm');
		const [u] = await db
			.select()
			.from(user)
			.where(eq(user.stravaAthleteId, body.owner_id ?? ''))
			.limit(1);
		if (u) {
			// Events are unsigned: a delete is only a hint the worker verifies with
			// Strava before removing the run (#233).
			const type = body.aspect_type === 'delete' ? 'delete_activity' : 'match_activity';
			await enqueueJob(type, { userId: u.id, activityId: body.object_id });
		}
	}
	return json({ ok: true });
};
