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
