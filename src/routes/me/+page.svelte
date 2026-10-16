<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate } from '$lib/dates';
	import { formatDuration } from '$lib/geo';
	import Seo from '$lib/components/Seo.svelte';
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let linking = $state(false);
	let linkError = $state('');

	async function connectStrava() {
		linking = true;
		linkError = '';
		const res = await authClient.linkSocial({ provider: 'strava', callbackURL: '/me' });
		if (res?.error) {
			linkError = res.error.message ?? 'Could not connect Strava';
			linking = false;
		}
	}
</script>

<Seo
	title="My results — RunAround"
	description="View your matched Strava runs and personal bests on RunAround's Townsville virtual race courses."
	origin={data.origin}
	path="/me"
	noindex
/>

<h1 class="text-3xl font-bold">My results</h1>
<p class="mt-2 text-stone-600">
	Logged in as {data.user?.name}.
	{#if data.hasStrava}New Strava activities are matched automatically.{/if}
</p>

{#if !data.hasStrava}
	<div class="mt-4 rounded-xl border border-stone-200 bg-white p-4">
		<p class="text-stone-700">
			{data.stravaNeedsReconnect
				? 'For account security, email verification removed the previous Strava connection. Reconnect Strava to resume automatic syncing.'
				: 'Connect Strava to match your runs automatically.'}
		</p>
		<button
			type="button"
			class="mt-3 rounded-full bg-[#fc4c02] px-4 py-2 font-semibold text-white disabled:opacity-60"
			onclick={connectStrava}
			disabled={linking}>{linking ? 'Redirecting…' : 'Connect Strava'}</button
		>
		{#if linkError}<p class="mt-2 text-red-700">{linkError}</p>{/if}
	</div>
{/if}

{#if data.mine.length === 0}
	<p class="mt-6 text-stone-700">
		No matched runs yet. Head out on a published course and sync Strava.
	</p>
{:else}
	<ul class="mt-6 space-y-2">
		{#each data.mine as row (row.slug + String(row.startedAt))}
			<li class="rounded-lg border border-stone-200 bg-white p-3">
				<a class="font-medium text-green-900" href={resolve('/races/[id]', { id: row.slug })}
					>{row.title}</a
				>
				— {formatDuration(row.timeMs)} on {formatDate(row.startedAt)}
			</li>
		{/each}
	</ul>
{/if}
