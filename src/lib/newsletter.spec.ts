import { describe, expect, it } from 'vitest';
import {
	monthlyIssue,
	monthlySendAt,
	newRaceIssue,
	newsletterEmail,
	nextMonthlySendAt
} from './newsletter';

describe('newsletter schedule (#168)', () => {
	it('names the issue by Brisbane month', () => {
		expect(monthlyIssue(new Date('2026-10-19T00:00:00Z'))).toBe('monthly-2026-10');
		// 1 Nov 01:00 Brisbane is already November.
		expect(monthlyIssue(new Date('2026-10-31T15:00:00Z'))).toBe('monthly-2026-11');
	});

	it('sends at 08:00 Brisbane on the first of the month', () => {
		const now = new Date('2026-10-19T00:00:00Z');
		expect(monthlySendAt(now).toISOString()).toBe('2026-09-30T22:00:00.000Z');
		expect(nextMonthlySendAt(now).toISOString()).toBe('2026-10-31T22:00:00.000Z');
	});

	it('keeps this month while the send time is still ahead', () => {
		const before = new Date('2026-09-30T20:00:00Z'); // 1 Oct 06:00 Brisbane
		expect(nextMonthlySendAt(before).toISOString()).toBe('2026-09-30T22:00:00.000Z');
	});

	it('keeps new-race announcements to one per Brisbane day', () => {
		expect(newRaceIssue(new Date('2026-10-18T13:00:00Z'))).toBe('races-2026-10-18');
		expect(newRaceIssue(new Date('2026-10-18T14:00:00Z'))).toBe('races-2026-10-19');
	});
});

describe('newsletterEmail', () => {
	const digest = {
		upcoming: [
			{
				slug: 'river-run',
				title: 'River Run',
				surface: 'road',
				distanceM: 5000,
				startsAt: new Date('2026-11-01T00:00:00Z'),
				endsAt: new Date('2026-11-30T00:00:00Z')
			}
		],
		winners: [
			{ slug: 'october', raceTitle: 'October Dash', name: 'Alex', rank: 1, timeMs: 1_200_000 }
		]
	};

	it('includes races, winners and the unsubscribe link', () => {
		const email = newsletterEmail({
			name: 'Runner',
			kind: 'monthly',
			digest,
			unsubscribeUrl: 'https://runaround.com.au/newsletter/unsubscribe?u=x&s=y',
			origin: 'https://runaround.com.au'
		});
		expect(email.subject).toContain('monthly');
		expect(email.text).toContain('River Run');
		expect(email.text).toContain('October Dash');
		expect(email.text).toContain('Unsubscribe');
		expect(email.html).toContain(
			'href="https://runaround.com.au/newsletter/unsubscribe?u=x&amp;s=y"'
		);
	});

	it('prefers the new race in the subject for announcements', () => {
		const email = newsletterEmail({
			name: 'Runner',
			kind: 'new_race',
			digest,
			unsubscribeUrl: 'https://runaround.com.au/newsletter/unsubscribe?u=x&s=y',
			origin: 'https://runaround.com.au'
		});
		expect(email.subject).toContain('River Run');
	});

	it('escapes HTML in user-provided names', () => {
		const email = newsletterEmail({
			name: '<script>alert(1)</script>',
			kind: 'new_race',
			digest,
			unsubscribeUrl: 'https://runaround.com.au/newsletter/unsubscribe?u=x&s=y',
			origin: 'https://runaround.com.au'
		});
		expect(email.html).not.toContain('<script>');
		expect(email.html).toContain('&lt;script&gt;');
	});
});
