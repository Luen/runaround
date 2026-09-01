<script lang="ts">
	let { children } = $props();
</script>

<article class="prose prose-stone max-w-3xl prose-img:max-w-full prose-img:h-auto">
	{@render children()}
</article>
