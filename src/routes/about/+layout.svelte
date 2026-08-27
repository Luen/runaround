<script lang="ts">
	let { children } = $props();
</script>

<article class="prose max-w-3xl prose-stone">
	{@render children()}
</article>
