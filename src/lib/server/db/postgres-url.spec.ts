import { afterEach, describe, expect, it } from 'vitest';
import { resolvePostgresUrl } from './postgres-url';

const KEYS = ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL'] as const;

function clearEnv() {
	for (const key of KEYS) delete process.env[key];
}

afterEach(() => {
	clearEnv();
});

describe('resolvePostgresUrl', () => {
	it('prefers POSTGRES_URL over POSTGRES_URL_NON_POOLING', () => {
		clearEnv();
		process.env['POSTGRES_URL'] = 'postgres://pooled';
		process.env['POSTGRES_URL_NON_POOLING'] = 'postgres://direct';
		expect(resolvePostgresUrl()).toBe('postgres://pooled');
	});

	it('falls back to POSTGRES_URL_NON_POOLING', () => {
		clearEnv();
		process.env['POSTGRES_URL_NON_POOLING'] = 'postgres://direct';
		expect(resolvePostgresUrl()).toBe('postgres://direct');
	});

	it('ignores DATABASE_URL and returns undefined when unset', () => {
		clearEnv();
		process.env['DATABASE_URL'] = 'postgres://legacy';
		expect(resolvePostgresUrl()).toBeUndefined();
	});

	it('trims whitespace', () => {
		clearEnv();
		process.env['POSTGRES_URL'] = '  postgres://pooled  ';
		expect(resolvePostgresUrl()).toBe('postgres://pooled');
	});
});
