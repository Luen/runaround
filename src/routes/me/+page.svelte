<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate } from '$lib/dates';
	import { formatDuration } from '$lib/geo';
	import Seo from '$lib/components/Seo.svelte';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let uploading = $state(false);
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
	Logged in as {data.user?.name}. New Strava activities are matched automatically.
</p>

{#if data.garmin}
	<section class="mt-6 max-w-xl rounded-xl border border-stone-200 bg-white p-4">
		<h2 class="text-lg font-semibold">Garmin Connect</h2>
		{#if data.garmin.status === 'failed'}
			<p class="mt-2 text-red-700">Could not connect Garmin. Please try again.</p>
		{/if}
		{#if data.garmin.connected}
			<p class="mt-1 text-sm text-stone-600">
				Connected. New runs synced to Garmin Connect are matched automatically.
			</p>
			<form method="post" action="?/disconnectGarmin" use:enhance class="mt-3">
				<button class="rounded-full border px-4 py-2 text-sm" type="submit"
					>Disconnect Garmin</button
				>
			</form>
		{:else}
			<p class="mt-1 text-sm text-stone-600">
				Connect Garmin to match runs from your watch without Strava.
			</p>
			<a
				class="mt-3 inline-block rounded-full bg-black px-4 py-2 text-white"
				href={resolve('/api/garmin/connect')}
				data-sveltekit-reload>Connect Garmin</a
			>
		{/if}
	</section>
{/if}

<section id="upload" class="mt-6 max-w-xl rounded-xl border border-stone-200 bg-white p-4">
	<h2 class="text-lg font-semibold">Upload a run (GPX)</h2>
	<p class="mt-1 text-sm text-stone-600">
		Export the recorded activity from your watch or app as GPX. It needs timestamps and has to cover
		most of a published course. Matched runs count on the leaderboards like Strava runs.
	</p>
	<form
		method="post"
		action="?/upload"
		enctype="multipart/form-data"
		class="mt-3 flex flex-wrap items-center gap-3"
		use:enhance={() => {
			uploading = true;
			return async ({ update }) => {
				await update();
				uploading = false;
			};
		}}
	>
		<input type="file" name="activity" accept=".gpx,application/gpx+xml" required />
		<button
			class="rounded-full bg-green-800 px-4 py-2 text-white disabled:opacity-60"
			type="submit"
			disabled={uploading}>{uploading ? 'Matching…' : 'Upload'}</button
		>
	</form>
	{#if form?.uploadError}
		<p class="mt-3 text-red-700">{form.uploadError}</p>
	{/if}
	{#if form?.uploaded}
		<ul class="mt-3 text-green-800" role="status">
			{#each form.uploaded as m (m.slug)}
				<li>
					Matched <a class="underline" href={resolve('/races/[id]', { id: m.slug })}>{m.title}</a>
					{m.timeMs === null
						? '(time hidden until results are revealed)'
						: `in ${formatDuration(m.timeMs)}`}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.mine.length === 0}
	<p class="mt-6 text-stone-700">
		No matched runs yet. Head out on a published course, then sync Strava or upload a GPX.
	</p>
{:else}
	<ul class="mt-6 space-y-2">
		{#each data.mine as row (row.slug + String(row.startedAt))}
			<li class="rounded-lg border border-stone-200 bg-white p-3">
				<a class="font-medium text-green-900" href={resolve('/races/[id]', { id: row.slug })}
					>{row.title}</a
				>
				— {row.timeMs === null
					? 'attempt received (time hidden until results are revealed)'
					: formatDuration(row.timeMs)} on {formatDate(row.startedAt)}
			</li>
		{/each}
	</ul>
{/if}
