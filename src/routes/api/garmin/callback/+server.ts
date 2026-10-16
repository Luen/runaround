import { error, redirect } from '@sveltejs/kit';
import { garminEnabled } from '$lib/garmin';
import { connectGarmin } from '$lib/server/garmin';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	if (!garminEnabled()) error(404, 'Garmin is not enabled');
	if (!locals.user) throw redirect(302, '/login?next=/me');
	const stored = cookies.get('garmin_pkce') ?? '';
	cookies.delete('garmin_pkce', { path: '/api/garmin' });
	const [state, verifier] = stored.split('.');
	const code = url.searchParams.get('code');
	if (!code || !state || !verifier || url.searchParams.get('state') !== state) {
		throw redirect(302, '/me?garmin=failed');
	}
	try {
		await connectGarmin({
			userId: locals.user.id,
			code,
			verifier,
			redirectUri: `${url.origin}/api/garmin/callback`
		});
	} catch (err) {
		console.error('Garmin connect failed', err);
		throw redirect(302, '/me?garmin=failed');
	}
	throw redirect(302, '/me?garmin=connected');
};
