<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { page } from '$app/state';
</script>

<Seo
	title="Signing out — RunAround"
	description="Signing out of RunAround."
	origin={page.data.origin}
	path="/logout"
	noindex
/>

<p>Signing out…</p>
