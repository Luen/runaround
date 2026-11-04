/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { resolve } from '$app/paths';
import { self } from '$app/service-worker';

/** Offline shell for static assets / built JS+CSS (#261). Not for race matching or auth. */
const CACHE = `runaround-${version}`;

const ASSETS = [
	...immutable.map((asset) => resolve(asset.path)),
	...assets.map((asset) => resolve(asset.path))
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
		})()
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	// Never cache API / auth / mutation-adjacent routes.
	if (
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/login') ||
		url.pathname.startsWith('/logout') ||
		url.pathname.startsWith('/me') ||
		url.pathname.startsWith('/admin') ||
		url.pathname.startsWith('/onboarding')
	) {
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			try {
				const response = await fetch(event.request);
				const cacheControl = response.headers.get('cache-control') ?? '';
				if (response.status === 200 && !cacheControl.includes('no-store')) {
					void cache.put(event.request, response.clone());
				}
				return response;
			} catch (error) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				throw error;
			}
		})()
	);
});
