import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
	email: z.string().email()
});

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	return { email: locals.user.needsEmail ? '' : locals.user.email };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const form = Object.fromEntries(await request.formData());
		const parsed = schema.safeParse(form);
		if (!parsed.success) {
			return fail(400, { message: 'Enter a valid email address' });
		}
		const email = parsed.data.email.toLowerCase();

		// `user.email` is unique; give a real error instead of a 500 (#230).
		const [taken] = await db
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.email, email), ne(user.id, locals.user.id)))
			.limit(1);
		if (taken) return fail(400, { message: 'That email is already in use.' });

		try {
			await db
				.update(user)
				// Never grant admin from a self-asserted email (#229); admins are
				// provisioned out of band with `pnpm run grant-admin`.
				.set({ email, needsEmail: false, emailVerified: false, updatedAt: new Date() })
				.where(eq(user.id, locals.user.id));
		} catch (err) {
			if ((err as { code?: string }).code === '23505') {
				return fail(400, { message: 'That email is already in use.' });
			}
			throw err;
		}
		throw redirect(302, '/me');
	}
};
