import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { setNewsletterOptIn, verifyNewsletterUnsubscribe } from '$lib/server/newsletter';
import type { Actions, PageServerLoad } from './$types';

function linkParams(url: URL) {
	return {
		userId: url.searchParams.get('u') ?? '',
		signature: url.searchParams.get('s')
	};
}

export const load: PageServerLoad = async ({ url }) => {
	const { userId, signature } = linkParams(url);
	if (!verifyNewsletterUnsubscribe(userId, signature)) {
		return { valid: false, email: null, optIn: false, done: false };
	}
	const [runner] = await db
		.select({ email: user.email, newsletterOptIn: user.newsletterOptIn })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	return {
		valid: Boolean(runner),
		email: runner?.email ?? null,
		optIn: Boolean(runner?.newsletterOptIn),
		done: url.searchParams.get('done') === '1'
	};
};

export const actions: Actions = {
	default: async ({ url }) => {
		const { userId, signature } = linkParams(url);
		if (!verifyNewsletterUnsubscribe(userId, signature)) {
			return fail(400, { message: 'This unsubscribe link is not valid.' });
		}
		const [runner] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!runner) return fail(404, { message: 'This unsubscribe link is not valid.' });
		await setNewsletterOptIn(runner.id, false);
		throw redirect(
			303,
			`/newsletter/unsubscribe?u=${encodeURIComponent(userId)}&s=${encodeURIComponent(signature ?? '')}&done=1`
		);
	}
};
