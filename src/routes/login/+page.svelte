<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let pending = $state(false);
	let error = $state('');
	let emailPending = $state(false);

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
	description="Sign in to RunAround with an email link or Strava to match your runs to Townsville virtual race courses and climb the leaderboards."
	origin={data.origin}
	path="/login"
	noindex
/>

<h1 class="text-3xl font-bold">Log in</h1>
{#if data.magicLinkEnabled}
	<p class="mt-3 max-w-xl text-stone-700">
		Join with your email — no password and no Strava account needed. You can upload a GPX or FIT
		file, or connect Strava later to sync runs automatically.
	</p>

	<section class="mt-6 max-w-md rounded-xl border border-stone-200 bg-white p-4">
		<h2 class="text-lg font-semibold">Sign in or join with email</h2>
		<p class="mt-1 text-sm text-stone-600">
			We'll email you a one-time sign-in link. It works once and expires in 15 minutes.
		</p>
		{#if data.linkError}
			<p class="mt-3 text-red-700">
				That sign-in link is invalid or has expired. Request a new one.
			</p>
		{/if}
		{#if form?.emailSent}
			<p class="mt-3 text-green-800" role="status">
				Check your inbox for a sign-in link. It expires in 15 minutes.
			</p>
		{:else}
			<form
				class="mt-3 space-y-3"
				method="post"
				use:enhance={() => {
					emailPending = true;
					return async ({ update }) => {
						await update();
						emailPending = false;
					};
				}}
			>
				<label class="block text-sm"
					>Email
					<input
						class="mt-1 w-full rounded-md border px-3 py-2"
						type="email"
						name="email"
						autocomplete="email"
						required
					/>
				</label>
				<label class="block text-sm"
					>Name (new runners, shown on leaderboards)
					<input
						class="mt-1 w-full rounded-md border px-3 py-2"
						type="text"
						name="name"
						autocomplete="name"
					/>
				</label>
				<label class="flex items-start gap-2 text-sm text-stone-700">
					<input class="mt-1" type="checkbox" name="newsletter" />
					<span
						>Email me the monthly RunAround newsletter with upcoming races and recent winners. You
						can unsubscribe at any time.</span
					>
				</label>
				<button
					class="rounded-full bg-green-800 px-4 py-2 text-white disabled:opacity-60"
					type="submit"
					disabled={emailPending}>{emailPending ? 'Sending…' : 'Email me a link'}</button
				>
				{#if form?.emailError}<p class="text-red-700">{form.emailError}</p>{/if}
			</form>
		{/if}
	</section>

	<div class="mt-8 max-w-md">
		<h2 class="text-lg font-semibold">Or connect Strava</h2>
		<p class="mt-1 text-sm text-stone-600">
			Already on Strava? Sign in with Strava and we'll sync your runs automatically.
		</p>
		<button
			type="button"
			class="mt-3 rounded-full bg-[#fc4c02] px-5 py-2 font-semibold text-white disabled:opacity-60"
			onclick={signIn}
			disabled={pending}
		>
			{pending ? 'Redirecting…' : 'Continue with Strava'}
		</button>
		{#if error}<p class="mt-3 text-red-700">{error}</p>{/if}
	</div>
{:else}
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
	{#if error}<p class="mt-3 text-red-700">{error}</p>{/if}
{/if}
