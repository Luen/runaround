<script lang="ts">
	import LeaderboardTable from '$lib/components/LeaderboardTable.svelte';
	import RaceMap from '$lib/components/RaceMap.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { sportsEventJsonLd } from '$lib/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let tab = $state<'race' | 'overall'>('race');
</script>

<Seo
	title={`${data.race.title} — RunAround`}
	description={data.race.description}
	origin={data.origin}
	path="/races/{data.race.slug}"
	jsonLd={sportsEventJsonLd(data.origin, data.race)}
/>

<p class="text-sm capitalize text-green-800">{data.race.surface} · {data.race.status}</p>
<h1 class="text-3xl font-bold">{data.race.title}</h1>
<p class="mt-2 max-w-2xl text-stone-700">{data.race.description}</p>
<p class="mt-2 text-sm text-stone-500">
	{(data.race.distanceM / 1000).toFixed(1)} km · {Math.round(data.race.elevationGainM)} m gain · race
	window {data.race.startsAt.toLocaleDateString()} – {data.race.endsAt.toLocaleDateString()}
</p>

<div class="mt-4 flex flex-wrap gap-3">
	<a class="rounded-full bg-green-800 px-4 py-2 text-white" href="/races/{data.race.slug}/gpx">Download GPX</a>
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
	<RaceMap focus={data.race.courseGeojson} />
</div>

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
</div>

<div class="mt-4">
	{#if tab === 'race'}
		<LeaderboardTable title="Race window" rows={data.raceBoard} />
	{:else}
		<LeaderboardTable title="Overall (all-time)" rows={data.overall} />
	{/if}
</div>
