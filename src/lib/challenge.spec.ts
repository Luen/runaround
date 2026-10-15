import { describe, expect, it } from 'vitest';
import { challengeMessage, challengeText, challengeUrl } from './challenge';

describe('challenge a friend', () => {
	it('builds an absolute race URL', () => {
		expect(challengeUrl('https://runaround.com.au', 'lady-widow-mv9d8nqx')).toBe(
			'https://runaround.com.au/races/lady-widow-mv9d8nqx'
		);
		expect(challengeUrl('https://runaround.com.au/', 'a b')).toBe(
			'https://runaround.com.au/races/a%20b'
		);
	});

	it('includes the challenger time when known', () => {
		expect(challengeText({ raceTitle: 'Castle Hill', timeMs: 1_234_000 })).toBe(
			'I just ran Castle Hill in 20:34. Think you can beat me?'
		);
		expect(
			challengeMessage({ raceTitle: 'Castle Hill', timeMs: 1_234_000, url: 'https://x/races/c' })
		).toBe('I just ran Castle Hill in 20:34. Think you can beat me? https://x/races/c');
	});

	it('falls back to a generic invite without a time', () => {
		expect(challengeText({ raceTitle: 'Castle Hill', timeMs: null })).toBe(
			"I'm challenging you to Castle Hill on RunAround. Think you can take it on?"
		);
	});
});
