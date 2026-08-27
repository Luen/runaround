<script lang="ts">
	import { formatDuration } from '$lib/geo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>My results — RunAround</title>
</svelte:head>

<h1 class="text-3xl font-bold">My results</h1>
<p class="mt-2 text-stone-600">
	Logged in as {data.user?.name}. New Strava activities are matched automatically.
</p>

{#if data.mine.length === 0}
	<p class="mt-6 text-stone-700">No matched runs yet. Head out on a published course and sync Strava.</p>
{:else}
	<ul class="mt-6 space-y-2">
		{#each data.mine as row (row.slug + String(row.startedAt))}
			<li class="rounded-lg border border-stone-200 bg-white p-3">
				<a class="font-medium text-green-900" href="/races/{row.slug}">{row.title}</a>
				— {formatDuration(row.timeMs)} on {new Date(row.startedAt).toLocaleDateString()}
			</li>
		{/each}
	</ul>
{/if}
