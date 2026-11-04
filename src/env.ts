import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_MAPTILER_API_KEY: {
		public: true,
		// Optional: maps fall back to OSM when unset (CI/local without a MapTiler key).
		schema: (value) => value
	}
});
