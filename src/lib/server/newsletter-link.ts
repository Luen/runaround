/**
 * Signed newsletter unsubscribe links (#168). Separate from the database-heavy
 * newsletter module so the signature logic is unit-tested without Postgres.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { siteOrigin } from '../origin';

export function newsletterSiteOrigin(): string {
	return siteOrigin(process.env.ORIGIN, 'https://runaround.com.au');
}

function secret(): string {
	return (
		process.env.NEWSLETTER_SECRET?.trim() ||
		process.env.BETTER_AUTH_SECRET?.trim() ||
		'dev-only-newsletter-secret-change-me'
	);
}

function signUnsubscribe(userId: string): string {
	return createHmac('sha256', secret())
		.update(`newsletter-unsubscribe:${userId}`)
		.digest('base64url');
}

export function newsletterUnsubscribeUrl(
	userId: string,
	site: string = newsletterSiteOrigin()
): string {
	const params = new URLSearchParams({ u: userId, s: signUnsubscribe(userId) });
	return `${site.replace(/\/$/, '')}/newsletter/unsubscribe?${params}`;
}

export function verifyNewsletterUnsubscribe(userId: string, signature: string | null): boolean {
	if (!userId || !signature) return false;
	const expected = Buffer.from(signUnsubscribe(userId));
	const given = Buffer.from(signature);
	return expected.length === given.length && timingSafeEqual(expected, given);
}
