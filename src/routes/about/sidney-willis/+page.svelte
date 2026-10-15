<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { personJsonLd } from '$lib/seo';
	import { page } from '$app/state';

	const description =
		'Sidney Willis is head coach at Hungry Runner Coaching and co-founder of the Townsville Virtual Running Series on RunAround.';
</script>

<Seo
	title="About Sidney Willis — RunAround"
	{description}
	origin={page.data.origin}
	path="/about/sidney-willis"
	type="profile"
	image="https://static.wixstatic.com/media/62e31f_b5925d57fcfe4117a6cdceccdf9c4fff~mv2.jpg"
	jsonLd={personJsonLd(page.data.origin, {
		name: 'Sidney Willis',
		description,
		path: '/about/sidney-willis',
		image: 'https://static.wixstatic.com/media/62e31f_b5925d57fcfe4117a6cdceccdf9c4fff~mv2.jpg',
		sameAs: ['https://hungryrunner.net/']
	})}
/>

<img
	src="https://static.wixstatic.com/media/62e31f_b5925d57fcfe4117a6cdceccdf9c4fff~mv2.jpg"
	alt="Sidney Willis"
	class="max-h-32"
/>
<h1>Sidney Willis</h1>
<p>Head Coach</p>
<p>
	Sidney is an Australian Frenchy with a passion for endurance sports. He played tennis at a
	national level, later switched to rock climbing, then trail running — from 10 km to 100 km ultras
	across Europe and Australia.
</p>
<p>
	His passion for sports and eye for detail had him start coaching fellow sport enthusiasts. Sidney
	uses his skills and experience to offer personalised training programs.
</p>
<p><a href="https://hungryrunner.net/">Hungry Runner Coaching</a></p>
