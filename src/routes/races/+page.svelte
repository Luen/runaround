<script lang="ts">
	import RaceMap from '$lib/components/RaceMap.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Races — RunAround</title>
	<meta name="description" content="Road and trail virtual races around Townsville, North Queensland." />
</svelte:head>

<h1 class="text-3xl font-bold">Races</h1>
<p class="mt-2 text-stone-600">Filter by surface. Every course has a race-window board and an overall board.</p>

<div class="mt-4 flex gap-3 text-sm">
	<a class="underline" href="/races">All</a>
	<a class="underline" href="/races?surface=road">Road</a>
	<a class="underline" href="/races?surface=trail">Trail</a>
</div>

<ul class="mt-6 space-y-3">
	{#each data.races as race (race.id)}
		<li class="rounded-xl border border-stone-200 bg-white p-4">
			<a class="text-lg font-semibold text-green-900" href="/races/{race.slug}">{race.title}</a>
			<p class="text-sm capitalize text-stone-500">{race.surface} · {race.status}</p>
			<p class="mt-1 text-stone-700">{race.description}</p>
		</li>
	{/each}
</ul>

<div class="mt-8">
	<RaceMap
		races={data.races.map((r) => ({ id: r.slug, title: r.title, geojson: r.courseGeojson }))}
	/>
</div>
