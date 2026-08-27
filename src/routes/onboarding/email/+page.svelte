<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Your email — RunAround</title>
</svelte:head>

<h1 class="text-3xl font-bold">Where should we email you?</h1>
<p class="mt-3 max-w-xl text-stone-700">
	Strava does not share your email. Add one so we can tell you if you gain a place, and send your
	result when a race window closes.
</p>

<form method="post" class="mt-6 max-w-md space-y-3" use:enhance>
	<label class="block text-sm font-medium">
		Email
		<input
			class="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
			type="email"
			name="email"
			value={data.email}
			required
		/>
	</label>
	<button class="rounded-full bg-green-800 px-4 py-2 text-white" type="submit">Save email</button>
	{#if form?.message}
		<p class="text-red-700">{form.message}</p>
	{/if}
</form>
