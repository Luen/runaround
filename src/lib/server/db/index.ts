import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { building } from '$app/environment';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function applyDotEnv() {
	const file = resolve(process.cwd(), '.env');
	if (!existsSync(file)) return;
	for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq < 1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

applyDotEnv();

const localDatabaseUrl = 'postgres://runaround:runaround@127.0.0.1:5432/runaround';

function databaseUrl(): string {
	// Bracket access avoids Vite replacing env reads at build time.
	const fromEnv = process.env['DATABASE_URL']?.trim();
	if (fromEnv) return fromEnv;

	// SvelteKit postbuild analysis runs on Vercel without runtime env vars.
	if (building) return localDatabaseUrl;

	if (process.env['VERCEL'] === '1' || process.env['NODE_ENV'] === 'production') {
		throw new Error('DATABASE_URL is not set');
	}

	return localDatabaseUrl;
}

export const postgresClient = postgres(databaseUrl());
export const db = drizzle(postgresClient, { schema });
