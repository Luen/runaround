import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Vercel sets VERCEL=1 at build time; Docker/local use adapter-node.
		adapter: process.env.VERCEL === '1' ? adapterVercel() : adapterNode(),
		env: {
			// Explicit so Vercel's Sensitive env UI can verify the public prefix.
			publicPrefix: 'PUBLIC_',
			privatePrefix: ''
		},
		typescript: {
			config: (config) => {
				config.include.push('../drizzle.config.ts');
			}
		}
	}
};

export default config;
