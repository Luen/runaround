<script lang="ts">
	import { formatDate } from '$lib/dates';
	import { formatDuration } from '$lib/geo';
	import {
		defaultSortDir,
		safeHttpUrl,
		sortRankedRows,
		type SortDir,
		type SortKey
	} from '$lib/boards';

	type Row = {
		rank: number;
		name: string;
		timeMs: number;
		startedAt: Date | string;
		source: string;
		effortUrl?: string | null;
		completions: number;
	};

	let { title, rows }: { title: string; rows: Row[] } = $props();

	let sortKey = $state<SortKey>('rank');
	let sortDir = $state<SortDir>('asc');
	const sorted = $derived(sortRankedRows(rows, sortKey, sortDir));

	function sortBy(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = defaultSortDir(key);
		}
	}

	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== key) return 'none';
		return sortDir === 'asc' ? 'ascending' : 'descending';
	}

	const columns: { key: SortKey; label: string }[] = [
		{ key: 'rank', label: 'Place' },
		{ key: 'time', label: 'Time' },
		{ key: 'completions', label: 'Completions' }
	];
</script>

{#snippet header(key: SortKey, label: string)}
	<th class="py-3 pr-4" aria-sort={ariaSort(key)}>
		<button
			type="button"
			class={[
				'inline-flex items-center gap-1 hover:text-green-900',
				sortKey === key && 'text-green-900'
			]}
			onclick={() => sortBy(key)}
		>
			{label}
			<span aria-hidden="true" class={['text-xs', sortKey !== key && 'text-stone-300']}>
				{sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
			</span>
		</button>
	</th>
{/snippet}

<section class="space-y-3">
	<h2 class="text-xl font-semibold">{title}</h2>
	{#if rows.length === 0}
		<p class="text-stone-600">No results yet.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead>
					<tr class="border-b border-stone-200">
						{@render header(columns[0].key, columns[0].label)}
						<th class="py-3 pr-4">Runner</th>
						{@render header(columns[1].key, columns[1].label)}
						{@render header(columns[2].key, columns[2].label)}
						<th class="py-3 pr-4">Date</th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as row (row.rank + row.name)}
						{@const effortHref = safeHttpUrl(row.effortUrl)}
						<tr class="border-b border-stone-100">
							<td class="py-3 pr-4 font-semibold">{row.rank}</td>
							<td class="py-3 pr-4">
								{row.name}
								{#if row.source === 'strava_import'}
									<span class="text-xs text-stone-400">imported</span>
								{/if}
							</td>
							<td class="py-3 pr-4">
								{#if effortHref}
									<!-- External Strava URL (https://www.strava.com/...); resolve() only applies to app routes. -->
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<a
										class="font-medium text-green-900 underline"
										href={effortHref}
										target="_blank"
										rel="noreferrer"
										title="Open on Strava">{formatDuration(row.timeMs)}</a
									>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{:else}
									{formatDuration(row.timeMs)}
								{/if}
							</td>
							<td class="py-3 pr-4">{row.completions}</td>
							<td class="py-3 pr-4">{formatDate(row.startedAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
