<script lang="ts">
	import { formatDuration } from '$lib/geo';

	type Row = {
		rank: number;
		name: string;
		timeMs: number;
		startedAt: Date | string;
		source: string;
	};

	let { title, rows }: { title: string; rows: Row[] } = $props();
</script>

<section class="space-y-3">
	<h2 class="text-xl font-semibold">{title}</h2>
	{#if rows.length === 0}
		<p class="text-stone-600">No results yet.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead>
					<tr class="border-b border-stone-200">
						<th class="py-2 pr-3">Place</th>
						<th class="py-2 pr-3">Runner</th>
						<th class="py-2 pr-3">Time</th>
						<th class="py-2 pr-3">Date</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.rank + row.name)}
						<tr class="border-b border-stone-100">
							<td class="py-2 pr-3 font-semibold">{row.rank}</td>
							<td class="py-2 pr-3">
								{row.name}
								{#if row.source === 'strava_import'}
									<span class="text-xs text-stone-400">imported</span>
								{/if}
							</td>
							<td class="py-2 pr-3">{formatDuration(row.timeMs)}</td>
							<td class="py-2 pr-3">{new Date(row.startedAt).toLocaleDateString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
