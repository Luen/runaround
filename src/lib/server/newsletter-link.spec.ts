import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	newsletterSiteOrigin,
	newsletterUnsubscribeUrl,
	verifyNewsletterUnsubscribe
} from './newsletter-link';

afterEach(() => vi.unstubAllEnvs());

describe('newsletter unsubscribe links', () => {
	it('round-trips a signed link', () => {
		vi.stubEnv('NEWSLETTER_SECRET', 'test-secret');
		vi.stubEnv('ORIGIN', 'https://runaround.com.au');
		const url = new URL(newsletterUnsubscribeUrl('runner-1'));
		expect(url.pathname).toBe('/newsletter/unsubscribe');
		expect(url.searchParams.get('u')).toBe('runner-1');
		expect(verifyNewsletterUnsubscribe('runner-1', url.searchParams.get('s'))).toBe(true);
	});

	it('rejects tampered or missing signatures', () => {
		vi.stubEnv('NEWSLETTER_SECRET', 'test-secret');
		expect(verifyNewsletterUnsubscribe('runner-1', 'not-a-signature')).toBe(false);
		expect(verifyNewsletterUnsubscribe('runner-2', null)).toBe(false);
		vi.stubEnv('NEWSLETTER_SECRET', 'a-different-secret');
		expect(verifyNewsletterUnsubscribe('runner-1', 'not-a-signature')).toBe(false);
	});

	it('falls back to the production origin', () => {
		vi.stubEnv('ORIGIN', '');
		expect(newsletterSiteOrigin()).toBe('https://runaround.com.au');
	});
});
