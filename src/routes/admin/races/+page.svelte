<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Admin races — RunAround</title>
</svelte:head>

<h1 class="text-3xl font-bold">Races</h1>
<p class="mt-2 text-stone-600">Publish Road or Trail courses. Runners cannot create races.</p>

<form method="post" action="?/create" enctype="multipart/form-data" class="mt-6 space-y-3 rounded-xl border border-stone-200 bg-white p-4" use:enhance>
	<h2 class="font-semibold">New race</h2>
	<label class="block text-sm">Title
		<input class="mt-1 w-full rounded-md border px-3 py-2" name="title" required />
	</label>
	<label class="block text-sm">Description
		<textarea class="mt-1 w-full rounded-md border px-3 py-2" name="description" required></textarea>
	</label>
	<label class="block text-sm">Surface
		<select class="mt-1 w-full rounded-md border px-3 py-2" name="surface">
			<option value="road">Road</option>
			<option value="trail">Trail</option>
		</select>
	</label>
	<label class="block text-sm">Starts
		<input class="mt-1 w-full rounded-md border px-3 py-2" type="datetime-local" name="startsAt" required />
	</label>
	<label class="block text-sm">Ends
		<input class="mt-1 w-full rounded-md border px-3 py-2" type="datetime-local" name="endsAt" required />
	</label>
	<label class="block text-sm">Optional Strava segment ID
		<input class="mt-1 w-full rounded-md border px-3 py-2" name="stravaSegmentId" />
	</label>
	<label class="block text-sm">Course GPX
		<input class="mt-1 w-full" type="file" name="gpx" accept=".gpx,application/gpx+xml,text/xml" required />
	</label>
	<button class="rounded-full bg-green-800 px-4 py-2 text-white" type="submit">Publish race</button>
	{#if form?.message}
		<p class="text-red-700">{form.message}</p>
	{/if}
</form>

<ul class="mt-8 space-y-2">
	{#each data.races as race (race.id)}
		<li>
			<a class="font-medium text-green-900 underline" href="/admin/races/{race.slug}">{race.title}</a>
			<span class="text-sm text-stone-500"> · {race.surface} · {race.status}</span>
		</li>
	{/each}
</ul>
