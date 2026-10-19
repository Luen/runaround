<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<Seo
	title="Newsletter — RunAround"
	description="Manage your RunAround newsletter subscription."
	origin={data.origin}
	path="/newsletter/unsubscribe"
	noindex
/>

<h1 class="text-3xl font-bold">Newsletter</h1>
{#if !data.valid}
	<p class="mt-3 max-w-xl text-stone-700">
		This unsubscribe link is not valid. If you keep receiving emails, reply to one and we will
		remove you.
	</p>
{:else if data.done || !data.optIn}
	<p class="mt-3 max-w-xl text-stone-700" role="status">
		You are unsubscribed from the RunAround newsletter. You will still receive race-result and
		leaderboard emails for runs you have matched.
	</p>
{:else}
	<p class="mt-3 max-w-xl text-stone-700">
		Unsubscribe <strong>{data.email}</strong> from the monthly RunAround newsletter? You will still receive
		race-result and leaderboard emails for runs you have matched.
	</p>
	<form method="post" class="mt-4">
		<button class="rounded-full bg-green-800 px-4 py-2 text-white" type="submit"
			>Unsubscribe me</button
		>
	</form>
{/if}
{#if form?.message}
	<p class="mt-3 text-red-700">{form.message}</p>
{/if}
