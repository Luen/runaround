import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { isPlaceholderEmail } from '$lib/server/identity';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) {
		return svelteKitHandler({ event, resolve, auth, building });
	}

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user as App.Locals['user'];
	}

	const path = event.url.pathname;
	const user = event.locals.user;
	if (
		user &&
		(user.needsEmail || isPlaceholderEmail(user.email)) &&
		!path.startsWith('/onboarding') &&
		!path.startsWith('/api/auth') &&
		!path.startsWith('/logout')
	) {
		throw redirect(302, '/onboarding/email');
	}

	if (path.startsWith('/admin') && !user?.isAdmin) {
		throw redirect(302, '/login');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
