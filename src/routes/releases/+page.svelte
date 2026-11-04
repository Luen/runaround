<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { displayVersion } from '#lib/releases.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatPublished(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'Australia/Brisbane'
		});
	}
</script>

<Seo
	title="Release notes — RunAround"
	description="What changed in each RunAround release: dependency updates, features, and fixes."
	origin={data.origin}
	path="/releases"
/>

<h1 class="text-3xl font-bold">Release notes</h1>
<p class="mt-2 text-stone-600">
	Versions ship from GitHub Releases (and optional GHCR images). The site currently runs
	<strong>v{displayVersion(data.appVersion)}</strong>.
</p>

{#if data.fetchError}
	<p class="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
		Could not load release notes from GitHub right now. See
		<a class="underline" href="https://github.com/Luen/runaround/releases">github.com/Luen/runaround/releases</a
		>.
	</p>
{:else if data.releases.length === 0}
	<p class="mt-6 text-stone-600">No published releases yet.</p>
{:else}
	<ul class="mt-8 space-y-8">
		{#each data.releases as release (release.tag)}
			<li class="border-b border-stone-200 pb-8 last:border-0">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h2 class="text-xl font-semibold text-green-900">
						<a class="underline" href={release.url} rel="noreferrer">{release.name}</a>
					</h2>
					{#if release.prerelease}
						<span class="text-xs font-medium tracking-wide text-amber-800 uppercase">Pre-release</span>
					{/if}
					{#if release.publishedAt}
						<span class="text-sm text-stone-500">{formatPublished(release.publishedAt)}</span>
					{/if}
				</div>
				{#if release.body}
					<pre
						class="mt-3 overflow-x-auto font-sans text-sm whitespace-pre-wrap text-stone-700">{release.body}</pre>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
