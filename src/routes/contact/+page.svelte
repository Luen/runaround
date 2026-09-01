<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { page } from '$app/state';
</script>

<Seo
	title="Contact RunAround"
	description="Get in touch with RunAround in Townsville."
	origin={page.data.origin}
	path="/contact"
/>

<h1 class="text-3xl font-bold">Contact</h1>
<p class="mt-4 text-stone-700">
	We are a friendly bunch. Email
	<a class="underline" href="mailto:info@runaround.com.au">info@runaround.com.au</a>
	and ask anything you like.
</p>
