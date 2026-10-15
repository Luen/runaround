import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const origin = process.env.ORIGIN ?? 'https://runaround.com.au';

function loc(path: string, lastmod?: Date | null) {
	const last = lastmod ? `\n    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
	return `  <url>\n    <loc>${origin}${path}</loc>${last}\n  </url>`;
}

export const GET: RequestHandler = async () => {
	const published = await db
		.select({ slug: races.slug, updatedAt: races.updatedAt })
		.from(races)
		.where(inArray(races.status, ['upcoming', 'live', 'closed']));
	const staticPages = [
		'/',
		'/races',
		'/about',
		'/about/luen-warneke',
		'/about/sidney-willis',
		'/contact'
	];
	const urls = [
		...staticPages.map((p) => loc(p)),
		...published.map((r) => loc(`/races/${r.slug}`, r.updatedAt))
	].join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
	);
};
