/**
 * Passwordless email login (#204). Off unless MAGIC_LINK_ENABLED=true and the
 * Cloudflare email env is set on the web app (links are sent inline from the
 * auth request, not via the worker queue, so they arrive immediately and the
 * one-time URL is never stored in the jobs table).
 */
export const MAGIC_LINK_EXPIRES_S = 15 * 60;

export function magicLinkEnabled(env: Record<string, string | undefined> = process.env): boolean {
	return (
		env.MAGIC_LINK_ENABLED?.trim().toLowerCase() === 'true' &&
		Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim()) &&
		Boolean(env.CLOUDFLARE_API_TOKEN?.trim())
	);
}

export function magicLinkEmail(opts: { url: string; minutes?: number }): {
	subject: string;
	html: string;
	text: string;
} {
	const minutes = opts.minutes ?? MAGIC_LINK_EXPIRES_S / 60;
	const subject = 'Your RunAround sign-in link';
	const text = `Use this link to sign in to RunAround:\n\n${opts.url}\n\nIt works once and expires in ${minutes} minutes. If you didn't ask for it, ignore this email.\n`;
	const href = opts.url.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
	const html = `<p>Use this link to sign in to RunAround:</p><p><a href="${href}">Sign in to RunAround</a></p><p>It works once and expires in ${minutes} minutes. If you didn't ask for it, ignore this email.</p>`;
	return { subject, html, text };
}

/** Where to send someone after login; only same-site paths are allowed. */
export function safeNextPath(next: string | null | undefined, fallback = '/me'): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
		return fallback;
	}
	return next;
}
