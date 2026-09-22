import { defineConfig } from 'drizzle-kit';
import { resolvePostgresUrl } from './src/lib/server/db/postgres-url';

const url = resolvePostgresUrl();
if (!url) throw new Error('POSTGRES_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	schemaFilter: ['public'],
	dbCredentials: { url },
	verbose: true,
	strict: true
});
