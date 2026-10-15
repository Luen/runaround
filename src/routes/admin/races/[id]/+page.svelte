<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import RaceMap from '$lib/components/RaceMap.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { raceCourseJsonUrl } from '$lib/geo';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function localValue(d: Date) {
		const dt = new Date(d);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
	}
</script>

<Seo
	title="Edit {data.race.title} — RunAround"
	description="Edit race details, course GPX, and race window for {data.race.title} on RunAround."
	origin={data.origin}
	path="/admin/races/{data.race.id}"
	noindex
/>

<h1 class="text-3xl font-bold">Edit race</h1>
<div class="mt-4">
	<RaceMap
		focus={data.race.courseGeojson}
		courseUrl={raceCourseJsonUrl(data.race.slug)}
		gpxHref={resolve('/races/[id]/gpx', { id: data.race.slug })}
	/>
</div>
<form method="post" action="?/update" enctype="multipart/form-data" class="mt-6 space-y-3" use:enhance>
	<label class="block text-sm">Title
		<input class="mt-1 w-full rounded-md border px-3 py-2" name="title" value={data.race.title} required />
	</label>
	<label class="block text-sm">Description
		<textarea class="mt-1 w-full rounded-md border px-3 py-2" name="description" required>{data.race.description}</textarea>
	</label>
	<label class="block text-sm">Surface
		<select class="mt-1 w-full rounded-md border px-3 py-2" name="surface" value={data.race.surface}>
			<option value="road">Road</option>
			<option value="trail">Trail</option>
		</select>
	</label>
	<label class="block text-sm">Starts
		<input class="mt-1 w-full rounded-md border px-3 py-2" type="datetime-local" name="startsAt" value={localValue(data.race.startsAt)} required />
	</label>
	<label class="block text-sm">Ends
		<input class="mt-1 w-full rounded-md border px-3 py-2" type="datetime-local" name="endsAt" value={localValue(data.race.endsAt)} required />
	</label>
	<label class="block text-sm">Strava segment ID
		<input class="mt-1 w-full rounded-md border px-3 py-2" name="stravaSegmentId" value={data.race.stravaSegmentId ?? ''} />
	</label>
	<label class="block text-sm">Replace GPX (optional)
		<input class="mt-1 w-full" type="file" name="gpx" accept=".gpx,application/gpx+xml,text/xml" />
	</label>
	<button class="rounded-full bg-green-800 px-4 py-2 text-white" type="submit">Save</button>
	{#if form?.message}
		<p class="text-red-700">{form.message}</p>
	{/if}
</form>
