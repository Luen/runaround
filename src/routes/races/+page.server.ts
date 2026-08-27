import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const surface = url.searchParams.get('surface');
	try {
		const all = await db.select().from(races).orderBy(desc(races.startsAt));
		const filtered =
			surface === 'road' || surface === 'trail' ? all.filter((r) => r.surface === surface) : all;
		return { races: filtered, surface: surface === 'road' || surface === 'trail' ? surface : 'all' };
	} catch (err) {
		console.error(err);
		return { races: [], surface: 'all' as const };
	}
};
