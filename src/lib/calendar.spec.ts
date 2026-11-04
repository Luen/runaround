import { describe, expect, it } from 'vitest';
import {
	buildCalendarFeed,
	calendarFeedUrl,
	escapeIcsText,
	foldIcsLine,
	formatBrisbaneDate,
	formatUtcDate,
	googleCalendarEventUrl,
	googleCalendarSubscribeUrl,
	raceCalendarUrl,
	webcalFeedUrl,
	type CalendarRace
} from './calendar';

const race: CalendarRace = {
	id: '11111111-1111-4111-8111-111111111111',
	slug: 'lady-widow',
	title: 'Lady Widow',
	description: 'A trail loop; bring water, sunscreen.',
	startsAt: new Date('2026-10-16T01:00:00Z'),
	endsAt: new Date('2026-12-31T13:59:59Z')
};

describe('calendar helpers', () => {
	it('builds feed and event URLs from the site origin', () => {
		expect(calendarFeedUrl('https://runaround.com.au/')).toBe(
			'https://runaround.com.au/calendar.ics'
		);
		expect(raceCalendarUrl('https://runaround.com.au', 'lady-widow')).toBe(
			'https://runaround.com.au/races/lady-widow/calendar.ics'
		);
		expect(webcalFeedUrl('https://runaround.com.au')).toBe(
			'webcal://runaround.com.au/calendar.ics'
		);
		expect(googleCalendarSubscribeUrl('https://runaround.com.au')).toBe(
			'https://calendar.google.com/calendar/render?cid=https%3A%2F%2Frunaround.com.au%2Fcalendar.ics'
		);
	});

	it('creates a Google one-event link with UTC dates', () => {
		const link = new URL(googleCalendarEventUrl('https://runaround.com.au', race));
		expect(link.searchParams.get('action')).toBe('TEMPLATE');
		expect(link.searchParams.get('text')).toBe('Lady Widow');
		expect(link.searchParams.get('dates')).toBe('20261016T010000Z/20261231T135959Z');
		expect(link.searchParams.get('details')).toContain('https://runaround.com.au/races/lady-widow');
	});

	it('formats UTC and Brisbane wall-clock timestamps', () => {
		expect(formatUtcDate(race.startsAt)).toBe('20261016T010000Z');
		expect(formatBrisbaneDate(race.startsAt)).toBe('20261016T110000');
	});

	it('escapes RFC 5545 text and folds long UTF-8 lines', () => {
		expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
		const folded = foldIcsLine(`SUMMARY:${'é'.repeat(60)}`);
		const lines = folded.split('\r\n');
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) {
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		}
		expect(lines.every((line, i) => i === 0 || line.startsWith(' '))).toBe(true);
	});

	it('emits a valid VCALENDAR with a Brisbane VTIMEZONE and one VEVENT per race', () => {
		const body = buildCalendarFeed({
			origin: 'https://runaround.com.au',
			races: [race],
			now: new Date('2026-10-01T00:00:00Z')
		});
		expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(body.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(body).toContain('VERSION:2.0');
		expect(body).toContain('PRODID:-//RunAround//Race calendar//EN');
		expect(body).toContain('TZID:Australia/Brisbane');
		expect(body).toContain('DTSTART;TZID=Australia/Brisbane:20261016T110000');
		expect(body).toContain('DTEND;TZID=Australia/Brisbane:20261231T235959');
		expect(body).toContain('SUMMARY:Lady Widow');
		expect(body).toContain('URL:https://runaround.com.au/races/lady-widow');
		expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
		expect(body.match(/END:VEVENT/g)).toHaveLength(1);
	});

	it('sorts events by start date', () => {
		const later = {
			...race,
			id: 'later',
			slug: 'later',
			title: 'Later',
			startsAt: new Date('2027-01-01T00:00:00Z')
		};
		const body = buildCalendarFeed({
			origin: 'https://runaround.com.au',
			races: [later, race]
		});
		expect(body.indexOf('SUMMARY:Lady Widow')).toBeLessThan(body.indexOf('SUMMARY:Later'));
	});
});
