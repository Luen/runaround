<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import './layout.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Pick up a new deploy's service worker on client navigations (#261).
	afterNavigate(async () => {
		if (!('serviceWorker' in navigator)) return;
		const registration = await navigator.serviceWorker.getRegistration();
		await registration?.update();
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="describedby" href="/llms.txt" />
	<link rel="author" href="/humans.txt" />
	<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
	<meta name="theme-color" content="#14532d" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="RunAround" />
</svelte:head>

{#if navigating}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-green-900/15"
		aria-hidden="true"
	>
		<div class="h-full w-1/3 animate-pulse bg-green-800"></div>
	</div>
{/if}

<div class="min-h-screen bg-stone-50 text-stone-900" class:cursor-progress={!!navigating}>
	<header class="border-b border-stone-200 bg-white">
		<div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
			<a href={resolve('/')} data-sveltekit-preload-code="viewport" class="flex items-center gap-3">
				<img src="/runaround-logo.png" alt="RunAround" class="h-10 w-auto" />
				<span class="text-lg font-semibold tracking-tight">RunAround</span>
			</a>
			<nav class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
				<a
					href={resolve('/races')}
					data-sveltekit-preload-code="viewport"
					class="inline-flex min-h-11 items-center py-2 hover:text-green-800">Races</a
				>
				<a
					href={resolve('/about')}
					data-sveltekit-preload-code="viewport"
					class="inline-flex min-h-11 items-center py-2 hover:text-green-800">About</a
				>
				<a
					href={resolve('/contact')}
					data-sveltekit-preload-code="viewport"
					class="inline-flex min-h-11 items-center py-2 hover:text-green-800">Contact</a
				>
				{#if data.user}
					<a
						href={resolve('/me')}
						data-sveltekit-preload-code="viewport"
						class="inline-flex min-h-11 items-center py-2 hover:text-green-800">My results</a
					>
					{#if data.user.isAdmin}
						<a
							href={resolve('/admin/races')}
							data-sveltekit-preload-code="viewport"
							class="inline-flex min-h-11 items-center py-2 hover:text-green-800">Admin</a
						>
					{/if}
					<form method="post" action="/logout">
						<button
							type="submit"
							class="inline-flex min-h-11 items-center py-2 hover:text-green-800">Log out</button
						>
					</form>
				{:else}
					<a
						href={resolve('/login')}
						data-sveltekit-preload-code="viewport"
						class="inline-flex min-h-11 items-center rounded-full bg-green-800 px-4 py-2 text-white hover:bg-green-900"
						>Log in</a
					>
				{/if}
			</nav>
		</div>
	</header>
	<main class="mx-auto max-w-5xl px-4 py-8">
		{@render children()}
	</main>
	<footer class="border-t border-stone-200 bg-white">
		<div class="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm text-stone-600">
			<p>
				<a class="underline" href="https://www.facebook.com/RunAroundAUS">Facebook</a>
				·
				<a class="underline" href="https://www.instagram.com/runaroundaus/">Instagram</a>
			</p>
			<p><i>Townsville, North Queensland, Australia</i></p>
			<p>
				Website by <a class="underline" href="https://wanderstories.space/author/luen/"
					>Luen Warneke</a
				>
				· Wanderstories &amp; Hungry Runner
			</p>
		</div>
	</footer>
</div>
