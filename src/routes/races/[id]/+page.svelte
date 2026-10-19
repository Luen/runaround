<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDateRange, formatDateTime } from '$lib/dates';
	import ChallengeFriend from '$lib/components/ChallengeFriend.svelte';
	import { challengeUrl } from '$lib/challenge';
	import LeaderboardTable from '$lib/components/LeaderboardTable.svelte';
	import TeamLeaderboardTable from '$lib/components/TeamLeaderboardTable.svelte';
	import RaceMap from '$lib/components/RaceMap.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { raceCourseJsonUrl } from '$lib/geo';
	import { sportsEventJsonLd } from '$lib/seo';
	import { googleCalendarEventUrl } from '$lib/calendar';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const calendarUrl = $derived(resolve('/races/[id]/calendar.ics', { id: data.race.slug }));
	let tab = $state<'race' | 'overall' | 'teams'>('race');
	const myBestMs = $derived(
		data.user ? (data.overall.find((r) => r.userId === data.user?.id)?.timeMs ?? null) : null
	);
</script>

<svelte:head>
	<link
		rel="alternate"
		type="text/calendar"
		title="{data.race.title} race window"
		href={calendarUrl}
	/>
</svelte:head>

<Seo
	title={`${data.race.title} — RunAround`}
	description={data.race.description}
	origin={data.origin}
	path="/races/{data.race.slug}"
	jsonLd={sportsEventJsonLd(data.origin, data.race)}
/>

<p class="text-sm text-green-800 capitalize">{data.race.surface} · {data.race.status}</p>
<h1 class="text-3xl font-bold">{data.race.title}</h1>
<p class="mt-2 max-w-2xl text-stone-700">{data.race.description}</p>
<p class="mt-2 text-sm text-stone-500">
	{(data.race.distanceM / 1000).toFixed(1)} km · {Math.round(data.race.elevationGainM)} m gain
	<a
		class="underline"
		href="https://mapterhorn.com/attribution"
		rel="noopener noreferrer"
		target="_blank"
		title="Elevation data for courses without it">(elevation © Mapterhorn)</a
	>
	· race window {formatDateRange(data.race.startsAt, data.race.endsAt)}
</p>

<div class="mt-4 flex flex-wrap gap-3">
	<a
		class="rounded-full bg-green-800 px-4 py-2 text-white"
		href={resolve('/races/[id]/gpx', { id: data.race.slug })}
		data-sveltekit-reload
		data-sveltekit-preload-data="off">Download GPX</a
	>
	<a
		class="rounded-full border border-stone-300 px-4 py-2"
		href={calendarUrl}
		data-sveltekit-reload
		data-sveltekit-preload-data="off">Add to calendar (.ics)</a
	>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- external calendar URL -->
	<a
		class="rounded-full border border-stone-300 px-4 py-2"
		href={googleCalendarEventUrl(data.origin, data.race)}
		target="_blank"
		rel="noreferrer">Add to Google Calendar</a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{#if data.race.stravaSegmentId}
		<a
			class="rounded-full border border-stone-300 px-4 py-2"
			href="https://www.strava.com/segments/{data.race.stravaSegmentId}"
			target="_blank"
			rel="noreferrer">Strava segment</a
		>
	{/if}
</div>

<div class="mt-6">
	<RaceMap
		focus={data.race.courseGeojson}
		courseUrl={raceCourseJsonUrl(data.race.slug)}
		gpxHref={resolve('/races/[id]/gpx', { id: data.race.slug })}
	/>
</div>

{#if data.resultsHidden}
	<div class="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
		<p class="font-semibold">
			Results are hidden until {formatDateTime(data.race.resultsRevealAt ?? data.race.endsAt)}.
		</p>
		<p class="mt-1 text-sm">
			Times and places are revealed when the race wraps up.
			{#if data.user}
				{#if data.myAttempts > 0}
					Attempt received ✔ — we have {data.myAttempts} matched run{data.myAttempts === 1
						? ''
						: 's'} from you.
				{:else}
					No matched run from you yet.
				{/if}
			{/if}
		</p>
		{#if data.resultsVisible}
			<p class="mt-1 text-sm">You are an admin, so the boards below are visible to you only.</p>
		{/if}
	</div>
{/if}

{#if data.resultsVisible}
	<div class="mt-8 flex gap-3">
		<button
			type="button"
			class={['rounded-full px-4 py-1.5', tab === 'race' ? 'bg-green-800 text-white' : 'border']}
			onclick={() => (tab = 'race')}>Race results</button
		>
		<button
			type="button"
			class={['rounded-full px-4 py-1.5', tab === 'overall' ? 'bg-green-800 text-white' : 'border']}
			onclick={() => (tab = 'overall')}>Overall</button
		>
		{#if data.race.teamSize}
			<button
				type="button"
				class={['rounded-full px-4 py-1.5', tab === 'teams' ? 'bg-green-800 text-white' : 'border']}
				onclick={() => (tab = 'teams')}>Teams of {data.race.teamSize}</button
			>
		{/if}
	</div>

	<div class="mt-4">
		{#if tab === 'race'}
			<LeaderboardTable title="Race window" rows={data.raceBoard} />
		{:else if tab === 'teams' && data.race.teamSize}
			<TeamLeaderboardTable title="Teams" teams={data.teams} teamSize={data.race.teamSize} />
		{:else}
			<LeaderboardTable title="Overall (all-time)" rows={data.overall} />
		{/if}
	</div>
{/if}

<ChallengeFriend
	raceTitle={data.race.title}
	url={challengeUrl(data.origin, data.race.slug)}
	timeMs={data.resultsHidden ? null : myBestMs}
/>
