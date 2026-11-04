/**
 * Pure helpers for scripts/nightly-release-check.mjs (unit-tested in
 * src/lib/server/nightlyRelease.spec.ts).
 *
 * The nightly dependency job releases only when an update can change the image
 * or the Vercel build. `dependencies` alone is not that set: SvelteKit bundles
 * svelte, kit, vite, tailwind and adapters into build/, and those are
 * devDependencies. So the rule is inverted: every changed package ships unless
 * it is a devDependency known to be lint/format/typecheck/test/migration
 * tooling. A new devDependency therefore releases until it is added below.
 */

/** devDependencies that never reach build/ or the runtime node_modules. */
export const TOOLING_DEV_DEPENDENCIES = new Set([
	'@eslint/js',
	'@playwright/test',
	'@vitest/browser-playwright',
	'drizzle-kit',
	'eslint',
	'eslint-config-prettier',
	'eslint-plugin-svelte',
	'globals',
	'playwright',
	'prettier',
	'prettier-plugin-svelte',
	'prettier-plugin-tailwindcss',
	'svelte-check',
	'typescript',
	'typescript-eslint',
	'vitest',
	'vitest-browser-svelte'
]);

const DEPENDENCY_FIELDS = [
	'dependencies',
	'optionalDependencies',
	'peerDependencies',
	'devDependencies'
];

/** @param {string} name */
export function isToolingDevDependency(name) {
	return name.startsWith('@types/') || TOOLING_DEV_DEPENDENCIES.has(name);
}

/**
 * @typedef {{ field: string, name: string, from: string | null, to: string | null, ships: boolean }} ManifestChange
 */

/**
 * Lists every changed dependency range, plus any other changed top-level field.
 * `packageManager` is build tooling: the frozen lockfile fixes what it installs.
 * Any other unexpected field change counts as shipping, to fail safe.
 *
 * @param {Record<string, any>} before
 * @param {Record<string, any>} after
 * @returns {ManifestChange[]}
 */
export function manifestChanges(before, after) {
	/** @type {ManifestChange[]} */
	const changes = [];
	for (const field of DEPENDENCY_FIELDS) {
		const a = before[field] ?? {};
		const b = after[field] ?? {};
		for (const name of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
			if (a[name] === b[name]) continue;
			const ships = field !== 'devDependencies' || !isToolingDevDependency(name);
			changes.push({ field, name, from: a[name] ?? null, to: b[name] ?? null, ships });
		}
	}
	const otherKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
	for (const field of [...otherKeys].sort()) {
		if (DEPENDENCY_FIELDS.includes(field) || field === 'version') continue;
		const a = before[field] === undefined ? null : JSON.stringify(before[field]);
		const b = after[field] === undefined ? null : JSON.stringify(after[field]);
		if (a === b) continue;
		changes.push({ field, name: field, from: a, to: b, ships: field !== 'packageManager' });
	}
	return changes;
}

/**
 * @param {Record<string, any>} before
 * @param {Record<string, any>} after
 */
export function releaseNeeded(before, after) {
	return manifestChanges(before, after).some((change) => change.ships);
}
