import { error, redirect } from '@sveltejs/kit';
import { garminAuthorizeUrl, garminEnabled, pkceChallenge, randomToken } from '$lib/garmin';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	if (!garminEnabled()) error(404, 'Garmin is not enabled');
	if (!locals.user) throw redirect(302, '/login?next=/me');
	const verifier = randomToken(48);
	const state = randomToken(24);
	cookies.set('garmin_pkce', `${state}.${verifier}`, {
		path: '/api/garmin',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 600
	});
	throw redirect(
		302,
		garminAuthorizeUrl({
			clientId: process.env.GARMIN_CLIENT_ID ?? '',
			redirectUri: `${url.origin}/api/garmin/callback`,
			state,
			codeChallenge: await pkceChallenge(verifier)
		})
	);
};
