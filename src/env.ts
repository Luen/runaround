import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_MAPTILER_API_KEY: {
		public: true
	}
});
