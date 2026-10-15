<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { personJsonLd } from '$lib/seo';
	import { page } from '$app/state';

	const description =
		'Luen Warneke builds RunAround, writes Wanderstories about North Queensland adventures, and leads outdoor clubs in Townsville.';
</script>

<Seo
	title="About Luen Warneke — RunAround"
	{description}
	origin={page.data.origin}
	path="/about/luen-warneke"
	type="profile"
	image="https://luenwarneke.com/img/luen-warneke.jpg"
	jsonLd={personJsonLd(page.data.origin, {
		name: 'Luen Warneke',
		description,
		path: '/about/luen-warneke',
		image: 'https://luenwarneke.com/img/luen-warneke.jpg',
		sameAs: ['https://luenwarneke.com/', 'https://wanderstories.space/']
	})}
/>

<img src="https://luenwarneke.com/img/luen-warneke.jpg" alt="Luen Warneke" class="max-h-32" />
<h1>Luen Warneke</h1>
<p>Professional Adventurer</p>
<p>
	Luen has been living in Townsville for most of his life and loves to explore the great outdoors.
	For the past several years, Luen has been writing articles for the
	<a href="https://wanderstories.space/">Wanderstories</a> website which documents the Townsville region's
	natural landscapes and associated adventures.
</p>
<p>
	Luen is a trip leader for the Townsville Rock Climbing Club (RANQ) and the president of the
	<a href="https://www.townsvillebushwalkingclub.com/">Townsville Bushwalking Club</a>.
</p>
<p><a href="https://wanderstories.space/">Wanderstories.space</a></p>
<p><a href="https://luenwarneke.com/">LuenWarneke.com</a></p>
