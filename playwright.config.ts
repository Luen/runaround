import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
		port: 4173,
		timeout: 120_000,
		reuseExistingServer: !process.env.CI,
		// `preview` is not `dev`, so auth refuses to fall back to the dev secret (#231).
		env: { BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-not-for-prod!!' }
	},
	testMatch: '**/*.e2e.{ts,js}'
});
