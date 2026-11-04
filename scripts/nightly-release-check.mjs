#!/usr/bin/env node
// Decides whether tonight's package.json changes need a release. Compares the
// working tree with HEAD and writes `release=true|false` to $GITHUB_OUTPUT.
// Rules live in nightlyRelease.mjs.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { manifestChanges } from './nightlyRelease.mjs';

const before = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' }));
const after = JSON.parse(readFileSync('package.json', 'utf8'));
const changes = manifestChanges(before, after);
const release = changes.some((change) => change.ships);

for (const change of changes) {
	const kind = change.ships ? 'ships' : 'tooling';
	console.log(`${kind}\t${change.field}\t${change.name}\t${change.from} -> ${change.to}`);
}
console.log(
	release
		? 'A shipped package changed: patch release.'
		: 'Only tooling changed: commit without a release.'
);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `release=${release}\n`);
