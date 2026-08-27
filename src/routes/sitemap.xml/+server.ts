import { db } from '$lib/server/db';
import { races } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const all = await db.select({ slug: races.slug }).from(races);
	const staticPages = ['', '/races', '/about', '/about/luen-warneke', '/about/sidney-willis', '/contact'];
	const urls = [
		...staticPages.map((p) => `  <url>\n    <loc>https://runaround.com.au${p || '/'}</loc>\n  </url>`),
		...all.map((r) => `  <url>\n    <loc>https://runaround.com.au/races/${r.slug}</loc>\n  </url>`)
	].join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
		{ headers: { 'Content-Type': 'application/xml' } }
	);
};
