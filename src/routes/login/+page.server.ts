import { redirect } from '@sveltejs/kit';
import { magicLinkEnabled, safeNextPath } from '$lib/server/magic-link';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(302, '/me');
	return {
		next: safeNextPath(url.searchParams.get('next')),
		magicLinkEnabled: magicLinkEnabled(),
		linkError: url.searchParams.get('error')
	};
};
