<script lang="ts">
	import './layout.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
	<meta name="theme-color" content="#14532d" />
</svelte:head>

<div class="min-h-screen bg-stone-50 text-stone-900">
	<header class="border-b border-stone-200 bg-white">
		<div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
			<a href="/" class="flex items-center gap-3">
				<img src="/runaround-logo.png" alt="RunAround" class="h-10 w-auto" />
				<span class="text-lg font-semibold tracking-tight">RunAround</span>
			</a>
			<nav class="flex flex-wrap items-center gap-4 text-sm font-medium">
				<a href="/races" class="hover:text-green-800">Races</a>
				<a href="/about" class="hover:text-green-800">About</a>
				<a href="/contact" class="hover:text-green-800">Contact</a>
				{#if data.user}
					<a href="/me" class="hover:text-green-800">My results</a>
					{#if data.user.isAdmin}
						<a href="/admin/races" class="hover:text-green-800">Admin</a>
					{/if}
					<form method="post" action="/logout">
						<button type="submit" class="hover:text-green-800">Log out</button>
					</form>
				{:else}
					<a
						href="/login"
						class="rounded-full bg-green-800 px-3 py-1.5 text-white hover:bg-green-900"
						>Log in with Strava</a
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
				Website by <a class="underline" href="https://wanderstories.space/author/luen/">Luen Warneke</a>
				· Wanderstories &amp; Hungry Runner
			</p>
		</div>
	</footer>
</div>
