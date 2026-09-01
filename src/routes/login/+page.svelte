<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/Seo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let pending = $state(false);
	let error = $state('');

	async function signIn() {
		pending = true;
		error = '';
		try {
			await authClient.signIn.social({ provider: 'strava', callbackURL: data.next });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not start Strava login';
			pending = false;
		}
	}
</script>

<Seo
	title="Log in — RunAround"
	description="Sign in to RunAround with Strava to match your runs to Townsville virtual race courses and climb the leaderboards."
	origin={data.origin}
	path="/login"
	noindex
/>

<h1 class="text-3xl font-bold">Log in with Strava</h1>
<p class="mt-3 max-w-xl text-stone-700">
	We only use Strava to sync your runs and match them to our courses. After you connect, we will ask
	for an email so we can tell you if you move up the leaderboard.
</p>
<button
	type="button"
	class="mt-6 rounded-full bg-[#fc4c02] px-5 py-2 font-semibold text-white disabled:opacity-60"
	onclick={signIn}
	disabled={pending}
>
	{pending ? 'Redirecting…' : 'Continue with Strava'}
</button>
{#if error}
	<p class="mt-3 text-red-700">{error}</p>
{/if}
