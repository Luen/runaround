<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/Seo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let pending = $state(false);
	let error = $state('');

	let email = $state('');
	let name = $state('');
	let emailPending = $state(false);
	let emailSent = $state(false);
	let emailError = $state('');

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

	async function sendLink(event: SubmitEvent) {
		event.preventDefault();
		emailPending = true;
		emailError = '';
		const res = await authClient.signIn.magicLink({
			email: email.trim(),
			name: name.trim() || undefined,
			callbackURL: data.next,
			errorCallbackURL: '/login'
		});
		emailPending = false;
		if (res.error) {
			emailError =
				res.error.status === 429
					? 'Too many requests. Wait a minute and try again.'
					: 'Could not send the link. Check the address and try again.';
		} else {
			emailSent = true;
		}
	}
</script>

<Seo
	title="Log in — RunAround"
	description="Sign in to RunAround with Strava or an email link to match your runs to Townsville virtual race courses and climb the leaderboards."
	origin={data.origin}
	path="/login"
	noindex
/>

<h1 class="text-3xl font-bold">Log in</h1>
<p class="mt-3 max-w-xl text-stone-700">
	Connect Strava to sync your runs and match them to our courses automatically. After you connect,
	we will ask for an email so we can tell you if you move up the leaderboard.
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

{#if data.magicLinkEnabled}
	<section class="mt-10 max-w-md rounded-xl border border-stone-200 bg-white p-4">
		<h2 class="text-lg font-semibold">Or sign in with email</h2>
		<p class="mt-1 text-sm text-stone-600">
			No Strava? We'll email you a one-time sign-in link. You can upload GPX files instead.
		</p>
		{#if data.linkError}
			<p class="mt-3 text-red-700">
				That sign-in link is invalid or has expired. Request a new one.
			</p>
		{/if}
		{#if emailSent}
			<p class="mt-3 text-green-800" role="status">
				Check your inbox for a sign-in link. It expires in 15 minutes.
			</p>
		{:else}
			<form class="mt-3 space-y-3" onsubmit={sendLink}>
				<label class="block text-sm"
					>Email
					<input
						class="mt-1 w-full rounded-md border px-3 py-2"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
					/>
				</label>
				<label class="block text-sm"
					>Name (new runners, shown on leaderboards)
					<input
						class="mt-1 w-full rounded-md border px-3 py-2"
						autocomplete="name"
						bind:value={name}
					/>
				</label>
				<button
					class="rounded-full bg-green-800 px-4 py-2 text-white disabled:opacity-60"
					type="submit"
					disabled={emailPending}>{emailPending ? 'Sending…' : 'Email me a link'}</button
				>
				{#if emailError}<p class="text-red-700">{emailError}</p>{/if}
			</form>
		{/if}
	</section>
{/if}
