import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	isToolingDevDependency,
	manifestChanges,
	releaseNeeded
} from '../../../scripts/nightlyRelease.mjs';

const base = {
	name: 'synthetic',
	version: '1.0.0',
	packageManager: 'pnpm@12.0.0',
	dependencies: { marked: '^18.0.0' },
	devDependencies: { '@sveltejs/kit': '^2.0.0', eslint: '^10.0.0', '@types/node': '^24.0.0' }
};

function withChange(patch: Record<string, unknown>) {
	return { ...structuredClone(base), ...patch };
}

describe('nightly release decision', () => {
	it('releases when a runtime dependency moves', () => {
		const after = withChange({ dependencies: { marked: '^18.1.0' } });
		expect(releaseNeeded(base, after)).toBe(true);
	});

	it('releases when a bundled devDependency such as SvelteKit moves', () => {
		const after = withChange({
			devDependencies: { ...base.devDependencies, '@sveltejs/kit': '^2.1.0' }
		});
		expect(releaseNeeded(base, after)).toBe(true);
	});

	it('commits tooling-only updates without a release', () => {
		const after = withChange({
			packageManager: 'pnpm@12.1.0',
			devDependencies: { ...base.devDependencies, eslint: '^10.1.0', '@types/node': '^24.1.0' }
		});
		expect(manifestChanges(base, after).map((c) => [c.name, c.ships])).toEqual([
			['@types/node', false],
			['eslint', false],
			['packageManager', false]
		]);
		expect(releaseNeeded(base, after)).toBe(false);
	});

	it('treats an unknown devDependency as shipped', () => {
		const after = withChange({
			devDependencies: { ...base.devDependencies, 'new-plugin': '^1.0.0' }
		});
		expect(releaseNeeded(base, after)).toBe(true);
	});

	it('treats a tooling name under dependencies as shipped', () => {
		const after = withChange({ dependencies: { ...base.dependencies, eslint: '^10.0.0' } });
		expect(releaseNeeded(base, after)).toBe(true);
	});

	it('fails safe on other unexpected manifest changes', () => {
		expect(releaseNeeded(base, withChange({ engines: { node: '>=27' } }))).toBe(true);
		expect(releaseNeeded(base, structuredClone(base))).toBe(false);
	});

	it('classifies every current devDependency deliberately', () => {
		const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
		const shipped = Object.keys(manifest.devDependencies)
			.filter((name) => !isToolingDevDependency(name))
			.sort();
		// Bundled into build/ by SvelteKit (or required for Vercel adapter selection).
		// Update this list (or the tooling set) whenever devDependencies change.
		expect(shipped).toEqual([
			'@sveltejs/adapter-node',
			'@sveltejs/adapter-vercel',
			'@sveltejs/kit',
			'@sveltejs/vite-plugin-svelte',
			'@tailwindcss/typography',
			'@tailwindcss/vite',
			'svelte',
			'tailwindcss',
			'vite'
		]);
	});
});
