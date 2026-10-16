import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { routeLeg } from '$lib/server/routing';
import type { RequestHandler } from './$types';

const coord = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const body = z.object({ from: coord, to: coord });

/** Admin-only (hooks guard /admin) proxy for one course leg, keeping the routing key server-side. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user?.isAdmin) error(403, 'Admins only');
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Expected { from: [lng, lat], to: [lng, lat] }');
	return json(await routeLeg(parsed.data.from, parsed.data.to));
};
