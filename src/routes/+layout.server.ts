import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
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
