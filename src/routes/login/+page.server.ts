import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { auth } from '#lib/server/auth.js';
import { magicLinkEnabled, safeNextPath } from '#lib/server/magic-link.js';
import { magicLinkRateLimited } from '#lib/server/magic-link-rate-limit.js';
import type { Actions, PageServerLoad } from './$types';

const signInSchema = z.object({
	email: z.string().trim().email().max(320),
	name: z.string().trim().max(100).optional(),
	newsletter: z.string().optional()
});

/** Attach newsletter consent to the magic-link callback the requester must click. */
function callbackWithNewsletter(next: string, newsletter: boolean): string {
	if (!newsletter) return next;
	const url = new URL(next, 'http://runaround.invalid');
	url.searchParams.set('newsletter', '1');
	return `${url.pathname}${url.search}`;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(302, '/me');
	return {
		next: safeNextPath(url.searchParams.get('next')),
		magicLinkEnabled: magicLinkEnabled(),
		linkError: url.searchParams.get('error')
	};
};

export const actions: Actions = {
	/** Email-first sign-in (#219). Consent rides on the magic-link callback (#168). */
	default: async ({ request, locals, url, getClientAddress }) => {
		if (locals.user) throw redirect(303, '/me');
		if (!magicLinkEnabled()) {
			return fail(404, { emailError: 'Email sign-in is not enabled.' });
		}
		const parsed = signInSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) {
			return fail(400, { emailError: 'Enter a valid email address.' });
		}
		const email = parsed.data.email.toLowerCase();
		const ip = getClientAddress();
		if (magicLinkRateLimited(ip, email)) {
			return fail(429, { emailError: 'Too many requests. Wait a minute and try again.' });
		}

		const next = safeNextPath(url.searchParams.get('next'));
		const callbackURL = callbackWithNewsletter(next, parsed.data.newsletter === 'on');

		try {
			await auth.api.signInMagicLink({
				body: {
					email,
					name: parsed.data.name || undefined,
					callbackURL,
					errorCallbackURL: '/login'
				},
				headers: request.headers
			});
		} catch (err) {
			console.error('Magic link email failed', err);
			const status = (err as { status?: string }).status;
			const rateLimited = status === 'TOO_MANY_REQUESTS' || /\b429\b|too many/i.test(String(err));
			return fail(rateLimited ? 429 : 502, {
				emailError: rateLimited
					? 'Too many requests. Wait a minute and try again.'
					: 'Could not send the link. Check the address and try again.'
			});
		}
		return { emailSent: true };
	}
};
