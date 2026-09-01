<script lang="ts">
	import { DEFAULT_OG_IMAGE, SITE_NAME, canonicalUrl } from '$lib/seo';

	let {
		title,
		description,
		origin,
		path = '',
		image = DEFAULT_OG_IMAGE,
		type = 'website',
		noindex = false,
		jsonLd
	}: {
		title: string;
		description: string;
		origin: string;
		path?: string;
		image?: string;
		type?: 'website' | 'article' | 'profile';
		noindex?: boolean;
		jsonLd?: Record<string, unknown> | Record<string, unknown>[];
	} = $props();

	const url = $derived(canonicalUrl(origin, path));
	const imageUrl = $derived(
		image.startsWith('http') ? image : canonicalUrl(origin, image)
	);
	const ld = $derived(jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
	{#if path !== undefined}
		<link rel="canonical" href={url} />
	{/if}
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:type" content={type} />
	<meta property="og:image" content={imageUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
	{#each ld as item (item['@type'])}
		<script type="application/ld+json">
			{JSON.stringify(item)}
		</script>
	{/each}
</svelte:head>
