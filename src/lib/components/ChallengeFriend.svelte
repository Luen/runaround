<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { challengeMessage, challengeText } from '$lib/challenge';

	let {
		raceTitle,
		url,
		timeMs = null
	}: { raceTitle: string; url: string; timeMs?: number | null } = $props();

	const text = $derived(challengeText({ raceTitle, timeMs }));
	const message = $derived(challengeMessage({ raceTitle, url, timeMs }));

	let canShare = $state(false);
	let status = $state<'idle' | 'copied' | 'error'>('idle');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	// navigator only exists in the browser; checked after hydration to avoid SSR mismatch.
	onMount(() => {
		canShare = typeof navigator.share === 'function';
	});
	onDestroy(() => clearTimeout(resetTimer));

	function flash(next: 'copied' | 'error') {
		status = next;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (status = 'idle'), 2500);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(message);
			flash('copied');
		} catch {
			flash('error');
		}
	}

	async function share() {
		try {
			await navigator.share({ title: raceTitle, text, url });
		} catch (err) {
			// User dismissing the sheet is not an error worth surfacing.
			if (err instanceof DOMException && err.name === 'AbortError') return;
			await copy();
		}
	}
</script>

<section
	class="mt-10 rounded-2xl border border-stone-200 bg-stone-50 p-5"
	aria-labelledby="challenge-heading"
>
	<h2 id="challenge-heading" class="text-xl font-semibold">Challenge a friend</h2>
	<p class="mt-1 text-sm text-stone-600">Send this race to a friend and see who's faster.</p>
	<p
		class="mt-3 rounded-lg border border-stone-200 bg-white p-3 text-sm break-words text-stone-800"
	>
		{message}
	</p>
	<div class="mt-3 flex flex-wrap items-center gap-3">
		{#if canShare}
			<button type="button" class="rounded-full bg-green-800 px-4 py-2 text-white" onclick={share}>
				Share
			</button>
		{/if}
		<button
			type="button"
			class={[
				'rounded-full px-4 py-2',
				canShare ? 'border border-stone-300' : 'bg-green-800 text-white'
			]}
			onclick={copy}
		>
			Copy link
		</button>
		<span class="text-sm" role="status" aria-live="polite">
			{#if status === 'copied'}
				<span class="text-green-800">Copied! Paste it to a friend.</span>
			{:else if status === 'error'}
				<span class="text-red-700">Couldn't copy. Select the text above instead.</span>
			{/if}
		</span>
	</div>
</section>
