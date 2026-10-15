import { describe, expect, it } from 'vitest';
import { authBaseUrl, siteOrigin } from './origin';
import { challengeUrl } from './challenge';

describe('siteOrigin', () => {
	it('uses a valid configured origin', () => {
		expect(siteOrigin('https://runaround.com.au/', 'http://x.test')).toBe(
			'https://runaround.com.au'
		);
	});
	it('falls back when ORIGIN is empty (Vercel production regression)', () => {
		expect(siteOrigin('', 'https://runaround.com.au')).toBe('https://runaround.com.au');
	});
	it('falls back when ORIGIN has no scheme', () => {
		expect(siteOrigin('runaround.com.au', 'https://runaround.com.au')).toBe(
			'https://runaround.com.au'
		);
	});
	it('falls back when unset', () => {
		expect(siteOrigin(undefined, 'http://localhost:5173')).toBe('http://localhost:5173');
	});
});

describe('challengeUrl', () => {
	it('does not throw on an empty origin', () => {
		expect(challengeUrl('', 'lady-widow')).toBe('/races/lady-widow');
	});
});

describe('authBaseUrl', () => {
	it('never falls back to localhost in production (login 404 regression)', () => {
		expect(authBaseUrl(undefined, undefined, false)).toBeUndefined();
		expect(authBaseUrl('', '', false)).toBeUndefined();
	});
	it('uses ORIGIN, then BETTER_AUTH_URL', () => {
		expect(authBaseUrl('https://runaround.com.au', 'https://x.test', false)).toBe(
			'https://runaround.com.au'
		);
		expect(authBaseUrl('', 'https://runaround.com.au/', false)).toBe('https://runaround.com.au');
	});
	it('uses localhost in dev', () => {
		expect(authBaseUrl(undefined, undefined, true)).toBe('http://localhost:5173');
	});
});
