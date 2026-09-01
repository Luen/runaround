import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const origin = process.env.ORIGIN ?? url.origin;
	return {
		origin,
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
