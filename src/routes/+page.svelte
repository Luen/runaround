<script lang="ts">
	import { resolve } from '$app/paths';
	import RaceMap from '$lib/components/RaceMap.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { websiteJsonLd } from '$lib/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const description =
		'RunAround is a Townsville virtual running series. Connect Strava, run published road and trail courses, and race the leaderboards.';

	/** null = use default (on when no active/upcoming); set once the user toggles. */
	let pastToggle = $state<boolean | null>(null);
	const showPastRaces = $derived(pastToggle ?? data.races.length === 0);

	const mapRaces = $derived(
		[
			...data.races,
			...(showPastRaces ? data.pastRaces : [])
		].map((r) => ({
			id: r.slug,
			title: r.title,
			geojson: r.courseGeojson,
			href: `/races/${r.slug}`,
			surface: r.surface,
			status: r.status,
			distanceM: r.distanceM
		}))
	);
</script>

<Seo
	title="RunAround — Virtual races in Townsville"
	{description}
	origin={data.origin}
	path="/"
	jsonLd={websiteJsonLd(data.origin, description)}
/>

<section class="space-y-6">
	<p class="text-sm uppercase tracking-wide text-green-800">Townsville virtual running</p>
	<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Run the city. Beat the board.</h1>
	<p class="max-w-2xl text-lg text-stone-700">
		Log in with Strava, run our Road and Trail courses in your own time, and we will match your GPS
		to the route. Race-window results sit beside an overall board so old courses stay alive.
	</p>
	<div class="flex flex-wrap gap-3">
		<a href={resolve('/races')} class="rounded-full bg-green-800 px-4 py-2 text-white hover:bg-green-900"
			>See races</a
		>
		<a href={resolve('/login')} class="rounded-full border border-stone-300 px-4 py-2 hover:bg-white">Connect Strava</a>
	</div>
</section>

<section class="mt-10 space-y-4">
	<h2 class="text-xl font-semibold">Active and upcoming</h2>
	{#if data.races.length === 0}
		<p class="text-stone-600">
			No live races right now. Browse the overall boards on past courses{#if data.pastRaces.length > 0}, or show past courses on the map below{/if}.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each data.races as race (race.id)}
				<li>
					<a class="font-medium text-green-900 underline" href={resolve('/races/[id]', { id: race.slug })}>{race.title}</a>
					<span class="text-sm text-stone-500"> · {race.surface}</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#if data.pastRaces.length > 0}
		<label class="flex items-center gap-2 text-sm text-stone-700">
			<input
				type="checkbox"
				class="size-4 rounded border-stone-300 text-green-800 focus:ring-green-800"
				checked={showPastRaces}
				onchange={(e) => {
					pastToggle = e.currentTarget.checked;
				}}
			/>
			Show past races on the map
		</label>
	{/if}
	<RaceMap races={mapRaces} />
</section>
