<script lang="ts">
	import { resolve } from '$app/paths';

	const racesHref = resolve('/races');
	import RaceMap from '$lib/components/RaceMap.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { formatDuration } from '$lib/geo';
	import { calendarFeedUrl, googleCalendarSubscribeUrl, webcalFeedUrl } from '$lib/calendar';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const feedUrl = $derived(calendarFeedUrl(data.origin));
</script>

<svelte:head>
	<link rel="alternate" type="text/calendar" title="RunAround race windows" href={feedUrl} />
</svelte:head>

<Seo
	title="Races — RunAround"
	description="Road and trail virtual races around Townsville, North Queensland."
	origin={data.origin}
	path="/races"
/>

<h1 class="text-3xl font-bold">Races</h1>
<p class="mt-2 text-stone-600">
	Filter by surface. Every course has a race-window board and an overall board.
</p>

<div class="mt-4 flex gap-3 text-sm">
	<a class="underline" href={resolve('/races')}>All</a>
	<a class="underline" href="{racesHref}?surface=road">Road</a>
	<a class="underline" href="{racesHref}?surface=trail">Trail</a>
</div>

<p class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
	<span>Add race windows to your calendar:</span>
	<a
		class="underline"
		href={resolve('/calendar.ics')}
		data-sveltekit-reload
		data-sveltekit-preload-data="off">Apple / Outlook (.ics)</a
	>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- external calendar URLs -->
	<a
		class="underline"
		href={googleCalendarSubscribeUrl(data.origin)}
		target="_blank"
		rel="noreferrer">Google Calendar</a
	>
	<a class="underline" href={webcalFeedUrl(data.origin)}>Subscribe</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</p>

<ul class="mt-6 space-y-3">
	{#each data.races as race (race.id)}
		<li class="rounded-xl border border-stone-200 bg-white p-4">
			<a
				class="text-lg font-semibold text-green-900"
				href={resolve('/races/[id]', { id: race.slug })}>{race.title}</a
			>
			<p class="text-sm text-stone-500 capitalize">
				{race.surface} · {race.status}{#if race.distanceM > 0}
					· {(race.distanceM / 1000).toFixed(1)} km{/if}
			</p>
			{#if race.raceWinner}
				<p class="text-sm text-stone-500">
					Race winner {race.raceWinner.name} · {formatDuration(race.raceWinner.timeMs)}
				</p>
			{/if}
			{#if race.allTime && (!race.raceWinner || race.allTime.name !== race.raceWinner.name || race.allTime.timeMs !== race.raceWinner.timeMs)}
				<p class="text-sm text-stone-500">
					All-time {race.allTime.name} · {formatDuration(race.allTime.timeMs)}
				</p>
			{/if}
			<p class="mt-1 text-stone-700">{race.description}</p>
		</li>
	{/each}
</ul>

<div class="mt-8">
	<RaceMap
		races={data.races.map((r) => ({
			id: r.slug,
			title: r.title,
			geojson: r.courseGeojson,
			href: `/races/${r.slug}`,
			surface: r.surface,
			status: r.status,
			distanceM: r.distanceM
		}))}
	/>
</div>
