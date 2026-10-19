<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import RaceMap from '$lib/components/RaceMap.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { formatDateTime, toBrisbaneInputValue } from '$lib/dates';
	import { formatDuration, raceCourseJsonUrl } from '$lib/geo';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<Seo
	title="Edit {data.race.title} — RunAround"
	description="Edit race details, course GPX, and race window for {data.race.title} on RunAround."
	origin={data.origin}
	path="/admin/races/{data.race.id}"
	noindex
/>

<h1 class="text-3xl font-bold">{data.editable ? 'Edit race' : data.race.title}</h1>
{#if !data.editable}
	<p class="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900" role="status">
		This race has finished and can no longer be edited. Its details are shown read-only.
	</p>
{/if}
<div class="mt-4">
	<RaceMap
		focus={data.race.courseGeojson}
		courseUrl={raceCourseJsonUrl(data.race.slug)}
		gpxHref={resolve('/races/[id]/gpx', { id: data.race.slug })}
	/>
</div>
<form
	method="post"
	action="?/update"
	enctype="multipart/form-data"
	class="mt-6 space-y-3"
	use:enhance
>
	<fieldset class="space-y-3" disabled={!data.editable}>
		<label class="block text-sm"
			>Title
			<input
				class="mt-1 w-full rounded-md border px-3 py-2"
				name="title"
				value={data.race.title}
				required
			/>
		</label>
		<label class="block text-sm"
			>Description
			<textarea class="mt-1 w-full rounded-md border px-3 py-2" name="description" required
				>{data.race.description}</textarea
			>
		</label>
		<label class="block text-sm"
			>Surface
			<select
				class="mt-1 w-full rounded-md border px-3 py-2"
				name="surface"
				value={data.race.surface}
			>
				<option value="road">Road</option>
				<option value="trail">Trail</option>
			</select>
		</label>
		<label class="block text-sm"
			>Starts
			<input
				class="mt-1 w-full rounded-md border px-3 py-2"
				type="datetime-local"
				name="startsAt"
				value={toBrisbaneInputValue(data.race.startsAt)}
				required
			/>
		</label>
		<label class="block text-sm"
			>Ends
			<input
				class="mt-1 w-full rounded-md border px-3 py-2"
				type="datetime-local"
				name="endsAt"
				value={toBrisbaneInputValue(data.race.endsAt)}
				required
			/>
		</label>
		<label class="block text-sm"
			>Hide results until (optional, Brisbane time)
			<input
				class="mt-1 w-full rounded-md border px-3 py-2"
				type="datetime-local"
				name="resultsRevealAt"
				value={data.race.resultsRevealAt ? toBrisbaneInputValue(data.race.resultsRevealAt) : ''}
			/>
			<span class="text-xs text-stone-500"
				>Times and places stay hidden from everyone except admins until this moment.</span
			>
		</label>
		<fieldset class="grid gap-3 rounded-md border border-stone-200 p-3 sm:grid-cols-3">
			<legend class="px-1 text-sm font-medium">Team board (optional)</legend>
			<label class="block text-sm"
				>Team size
				<input
					class="mt-1 w-full rounded-md border px-3 py-2"
					type="number"
					min="2"
					max="20"
					name="teamSize"
					placeholder="Off"
					value={data.race.teamSize ?? ''}
				/>
			</label>
			<label class="block text-sm"
				>Max separation (m)
				<input
					class="mt-1 w-full rounded-md border px-3 py-2"
					type="number"
					min="50"
					name="teamMaxSeparationM"
					value={data.race.teamMaxSeparationM}
				/>
			</label>
			<label class="block text-sm"
				>Max start/finish gap (s)
				<input
					class="mt-1 w-full rounded-md border px-3 py-2"
					type="number"
					min="10"
					name="teamMaxStartGapS"
					value={data.race.teamMaxStartGapS}
				/>
			</label>
		</fieldset>
		<label class="block text-sm"
			>Strava segment ID
			<input
				class="mt-1 w-full rounded-md border px-3 py-2"
				name="stravaSegmentId"
				value={data.race.stravaSegmentId ?? ''}
			/>
		</label>
		<label class="block text-sm"
			>Replace GPX (optional)
			<input
				class="mt-1 w-full"
				type="file"
				name="gpx"
				accept=".gpx,application/gpx+xml,text/xml"
			/>
		</label>
		<button
			class="rounded-full bg-green-800 px-4 py-2 text-white"
			type="submit"
			hidden={!data.editable}>Save</button
		>
	</fieldset>
	{#if form?.message}
		<p class="text-red-700">{form.message}</p>
	{/if}
</form>

<section class="mt-8 space-y-2">
	<h2 class="text-xl font-semibold">Uploaded GPX attempts</h2>
	{#if data.uploads.length === 0}
		<p class="text-stone-600">No runner uploads on this race.</p>
	{:else}
		<ul class="space-y-2">
			{#each data.uploads as up (up.id)}
				<li
					class="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 {up.flaggedReason
						? 'border-amber-400'
						: 'border-stone-200'}"
				>
					<span class="font-medium">{up.name ?? 'Runner'}</span>
					<span>{formatDuration(up.timeMs)}</span>
					<span class="text-sm text-stone-500">{formatDateTime(up.startedAt)} · {up.fileName}</span>
					{#if up.flaggedReason}
						<span class="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900"
							>Flagged: {up.flaggedReason}</span
						>
						<form method="post" action="?/clearUploadFlag" use:enhance>
							<input type="hidden" name="attemptId" value={up.id} />
							<button class="rounded-full border border-amber-300 px-3 py-1 text-sm" type="submit"
								>Mark reviewed</button
							>
						</form>
					{/if}
					<form method="post" action="?/removeUpload" use:enhance>
						<input type="hidden" name="attemptId" value={up.id} />
						<button
							class="rounded-full border border-red-300 px-3 py-1 text-sm text-red-700"
							type="submit">Remove</button
						>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
	{#if form?.message}
		<p class="text-red-700">{form.message}</p>
	{/if}
</section>
