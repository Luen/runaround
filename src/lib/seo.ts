export const SITE_NAME = 'RunAround';
export const DEFAULT_OG_IMAGE = '/runaround-logo.png';

export function canonicalUrl(origin: string, path: string): string {
	const base = origin.replace(/\/$/, '');
	if (!path || path === '/') return `${base}/`;
	return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function websiteJsonLd(origin: string, description: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: canonicalUrl(origin, '/'),
		description
	};
}

export function sportsEventJsonLd(
	origin: string,
	race: {
		title: string;
		description: string;
		slug: string;
		startsAt: Date;
		endsAt: Date;
	}
) {
	return {
		'@context': 'https://schema.org',
		'@type': 'SportsEvent',
		name: race.title,
		description: race.description,
		startDate: race.startsAt.toISOString(),
		endDate: race.endsAt.toISOString(),
		eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
		eventStatus: 'https://schema.org/EventScheduled',
		location: {
			'@type': 'Place',
			name: 'Townsville, Queensland, Australia'
		},
		url: canonicalUrl(origin, `/races/${race.slug}`)
	};
}

export function personJsonLd(
	origin: string,
	person: { name: string; description: string; path: string; image?: string; sameAs?: string[] }
) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: person.name,
		description: person.description,
		url: canonicalUrl(origin, person.path),
		...(person.image ? { image: person.image } : {}),
		...(person.sameAs?.length ? { sameAs: person.sameAs } : {})
	};
}

/**
 * Render a JSON-LD object as the full <script> tag. Svelte treats a literal
 * `<script>` body as text, so `JSON.stringify` inside it was shipped verbatim
 * (#224). Escaping `<` also stops a value containing `</script>` breaking out.
 */
export function jsonLdScript(item: Record<string, unknown>): string {
	const json = JSON.stringify(item)
		.replaceAll('<', '\\u003c')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029');
	return `<script type="application/ld+json">${json}</script>`;
}
