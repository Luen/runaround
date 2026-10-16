import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { adminEmails } from '$lib/server/identity';
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
		const [taken] = await db
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.email, email), ne(user.id, locals.user.id)))
			.limit(1);
		if (taken) {
			return fail(400, {
				message:
					'That email already has a RunAround account. Log out, sign in with that email, then use "Connect Strava" on My results.'
			});
		}
		const isAdmin = adminEmails().includes(email);
		await db
			.update(user)
			.set({ email, needsEmail: false, emailVerified: false, isAdmin, updatedAt: new Date() })
			.where(eq(user.id, locals.user.id));
		throw redirect(302, '/me');
	}
};
