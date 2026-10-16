<script lang="ts">
	import { formatDate } from '$lib/dates';
	import { formatDuration } from '$lib/geo';

	type Team = {
		rank: number;
		timeMs: number;
		startedAt: Date | string;
		members: { attemptId: string; name: string; timeMs: number }[];
	};

	let { title, teams, teamSize }: { title: string; teams: Team[]; teamSize: number } = $props();
</script>

<section class="space-y-3">
	<h2 class="text-xl font-semibold">{title}</h2>
	<p class="text-sm text-stone-600">
		Teams of {teamSize} are linked automatically when runners start and finish together and stay within
		about a kilometre of each other. Team time is the average of the {teamSize} runners' times.
	</p>
	{#if teams.length === 0}
		<p class="text-stone-600">No teams yet.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead>
					<tr class="border-b border-stone-200">
						<th class="py-3 pr-4">Place</th>
						<th class="py-3 pr-4">Team</th>
						<th class="py-3 pr-4">Team time</th>
						<th class="py-3 pr-4">Date</th>
					</tr>
				</thead>
				<tbody>
					{#each teams as team (team.members.map((m) => m.attemptId).join('|'))}
						<tr class="border-b border-stone-100 align-top">
							<td class="py-3 pr-4 font-semibold">{team.rank}</td>
							<td class="py-3 pr-4">
								<ul>
									{#each team.members as m (m.attemptId)}
										<li>
											{m.name}
											<span class="text-xs text-stone-500">{formatDuration(m.timeMs)}</span>
										</li>
									{/each}
								</ul>
							</td>
							<td class="py-3 pr-4 font-medium">{formatDuration(team.timeMs)}</td>
							<td class="py-3 pr-4">{formatDate(team.startedAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
