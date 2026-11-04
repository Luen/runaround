import { describe, expect, it } from 'vitest';
import { magicLinkEmail, magicLinkEnabled, safeNextPath } from './magic-link';

describe('magicLinkEnabled', () => {
	const cf = { CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' };
	it('is off by default', () => {
		expect(magicLinkEnabled({})).toBe(false);
		expect(magicLinkEnabled(cf)).toBe(false);
	});
	it('needs the flag and email credentials', () => {
		expect(magicLinkEnabled({ MAGIC_LINK_ENABLED: 'true' })).toBe(false);
		expect(magicLinkEnabled({ MAGIC_LINK_ENABLED: 'TRUE', ...cf })).toBe(true);
	});
});

describe('magicLinkEmail', () => {
	it('includes the link and expiry and escapes the href', () => {
		const m = magicLinkEmail({
			url: 'https://runaround.com.au/api/auth/magic-link/verify?token=x&cb=/me'
		});
		expect(m.text).toContain('token=x&cb=/me');
		expect(m.text).toContain('15 minutes');
		expect(m.html).toContain('token=x&amp;cb=/me');
	});
});

describe('safeNextPath', () => {
	it('keeps same-site paths and rejects others', () => {
		expect(safeNextPath('/races/x')).toBe('/races/x');
		expect(safeNextPath('https://evil.example')).toBe('/me');
		expect(safeNextPath('//evil.example')).toBe('/me');
		expect(safeNextPath(null)).toBe('/me');
	});
});
