<script lang="ts">
	let { children } = $props();
</script>

<article class="prose max-w-3xl prose-stone prose-img:h-auto prose-img:max-w-full">
	{@render children()}
</article>
