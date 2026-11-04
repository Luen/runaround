import { describe, expect, it } from 'vitest';
import { magicLinkRateLimited, resetMagicLinkRateLimit } from './magic-link-rate-limit';

describe('magicLinkRateLimited', () => {
	it('allows a few sends then blocks within the window', () => {
		resetMagicLinkRateLimit();
		const now = 1_000_000;
		expect(magicLinkRateLimited('1.1.1.1', 'a@b.co', now)).toBe(false);
		expect(magicLinkRateLimited('1.1.1.1', 'a@b.co', now + 1)).toBe(false);
		expect(magicLinkRateLimited('1.1.1.1', 'a@b.co', now + 2)).toBe(false);
		expect(magicLinkRateLimited('1.1.1.1', 'a@b.co', now + 3)).toBe(true);
		expect(magicLinkRateLimited('1.1.1.1', 'other@b.co', now + 3)).toBe(false);
		expect(magicLinkRateLimited('1.1.1.1', 'a@b.co', now + 60_001)).toBe(false);
	});
});
