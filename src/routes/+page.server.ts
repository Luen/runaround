import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const active = await db
			.select()
			.from(races)
			.where(inArray(races.status, ['live', 'upcoming']));
		return { races: active };
	} catch (err) {
		console.error(err);
		return { races: [] };
	}
};
