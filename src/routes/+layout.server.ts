import { siteOrigin } from '#lib/origin.js';
import { displayVersion } from '#lib/releases.js';
import { version as packageVersion } from '../../package.json';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const origin = siteOrigin(process.env.ORIGIN, url.origin);
	return {
		origin,
		appVersion: displayVersion(packageVersion),
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					email: locals.user.email,
					isAdmin: Boolean(locals.user.isAdmin),
					image: locals.user.image
				}
			: null
	};
};
