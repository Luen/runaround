import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const active = await db
			.select()
			.from(races)
			.where(inArray(races.status, ['live', 'upcoming']));
		const pastRaces = await db
			.select()
			.from(races)
			.where(eq(races.status, 'closed'))
			.orderBy(desc(races.startsAt));
		return { races: active, pastRaces };
	} catch (err) {
		console.error(err);
		return { races: [], pastRaces: [] };
	}
};
