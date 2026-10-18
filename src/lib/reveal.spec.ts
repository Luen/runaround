import { describe, expect, it } from 'vitest';
import { canSeeResults, resultsHidden } from './reveal';

const now = new Date('2027-06-01T00:00:00Z');

describe('resultsHidden', () => {
	it('is false when no reveal date is set', () => {
		expect(resultsHidden({ resultsRevealAt: null }, now)).toBe(false);
	});
	it('is true before the reveal date', () => {
		expect(resultsHidden({ resultsRevealAt: new Date('2027-12-31T14:00:00Z') }, now)).toBe(true);
	});
	it('is false at and after the reveal date', () => {
		expect(resultsHidden({ resultsRevealAt: now }, now)).toBe(false);
		expect(resultsHidden({ resultsRevealAt: '2027-01-01T00:00:00Z' }, now)).toBe(false);
	});
	it('ignores an invalid date', () => {
		expect(resultsHidden({ resultsRevealAt: 'nope' }, now)).toBe(false);
	});
});

describe('canSeeResults', () => {
	const hidden = { resultsRevealAt: new Date('2028-01-01T00:00:00Z') };
	it('lets admins see hidden results', () => {
		expect(canSeeResults(hidden, { isAdmin: true }, now)).toBe(true);
	});
	it('hides results from runners and the public', () => {
		expect(canSeeResults(hidden, { isAdmin: false }, now)).toBe(false);
		expect(canSeeResults(hidden, null, now)).toBe(false);
	});
	it('shows results once revealed', () => {
		expect(canSeeResults({ resultsRevealAt: null }, null, now)).toBe(true);
	});
});
