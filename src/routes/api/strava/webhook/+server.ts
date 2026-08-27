import { json, text } from '@sveltejs/kit';
import { enqueueJob } from '$lib/server/jobs';
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
	const body = (await request.json()) as {
		object_type?: string;
		aspect_type?: string;
		object_id?: number;
		owner_id?: number;
	};
	if (body.object_type === 'activity' && (body.aspect_type === 'create' || body.aspect_type === 'update')) {
		const { db } = await import('$lib/server/db');
		const { user } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');
		const [u] = await db
			.select()
			.from(user)
			.where(eq(user.stravaAthleteId, String(body.owner_id)))
			.limit(1);
		if (u) {
			await enqueueJob('match_activity', { userId: u.id, activityId: String(body.object_id) });
		}
	}
	return json({ ok: true });
};
