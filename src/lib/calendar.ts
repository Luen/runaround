/**
 * iCalendar (RFC 5545) feed for race windows (#171). Pure so the format is
 * unit-tested and the routes only supply published races.
 */
import { formatDateRange } from './dates';

export type CalendarRace = {
	id: string;
	slug: string;
	title: string;
	description?: string;
	startsAt: Date;
	endsAt: Date;
};

export const CALENDAR_NAME = 'RunAround race windows';
export const CALENDAR_DESCRIPTION =
	'Virtual race windows around Townsville, North Queensland. Subscribe once and new races appear automatically.';
export const CALENDAR_LOCATION = 'Townsville, Queensland, Australia';
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

export function calendarFeedUrl(origin: string): string {
	return `${origin.replace(/\/$/, '')}/calendar.ics`;
}

export function raceCalendarUrl(origin: string, slug: string): string {
	return `${origin.replace(/\/$/, '')}/races/${slug}/calendar.ics`;
}

/** Google Calendar's add-by-URL form. Google fetches and subscribes to the feed. */
export function googleCalendarSubscribeUrl(origin: string): string {
	return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(calendarFeedUrl(origin))}`;
}

/** Google Calendar's one-event template form for a single race. */
export function googleCalendarEventUrl(origin: string, race: CalendarRace): string {
	const url = `${origin.replace(/\/$/, '')}/races/${race.slug}`;
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: race.title,
		dates: `${formatUtcDate(race.startsAt)}/${formatUtcDate(race.endsAt)}`,
		details: `${race.description?.trim() || race.title}\n\n${url}`,
		location: CALENDAR_LOCATION
	});
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Apple Calendar and other desktop apps accept the webcal scheme. */
export function webcalFeedUrl(origin: string): string {
	return calendarFeedUrl(origin).replace(/^https?:/, 'webcal:');
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** `YYYYMMDDTHHMMSSZ` in UTC, used for DTSTAMP and Google's dates parameter. */
export function formatUtcDate(value: Date): string {
	return (
		`${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}` +
		`T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}Z`
	);
}

/** `YYYYMMDDTHHMMSS` as Brisbane wall-clock time (AEST, no DST). */
export function formatBrisbaneDate(value: Date): string {
	const shifted = new Date(value.getTime() + BRISBANE_OFFSET_MS);
	return (
		`${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}` +
		`T${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())}${pad(shifted.getUTCSeconds())}`
	);
}

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
	return value
		.replaceAll('\\', '\\\\')
		.replaceAll(';', '\\;')
		.replaceAll(',', '\\,')
		.replaceAll(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a content line to 75 UTF-8 octets, continuing on a line that starts with
 * one space. Counts bytes rather than characters so race titles with accents or
 * emoji stay valid.
 */
export function foldIcsLine(line: string): string {
	const encoder = new TextEncoder();
	const parts: string[] = [];
	let current = '';
	let bytes = 0;
	for (const char of line) {
		const size = encoder.encode(char).length;
		if (bytes + size > 75 && current) {
			parts.push(current);
			current = ` ${char}`;
			bytes = 1 + size;
		} else {
			current += char;
			bytes += size;
		}
	}
	parts.push(current);
	return parts.join('\r\n');
}

function eventLines(origin: string, race: CalendarRace, now: Date): string[] {
	const url = `${origin.replace(/\/$/, '')}/races/${race.slug}`;
	const description = [
		race.description?.trim(),
		`Race window: ${formatDateRange(race.startsAt, race.endsAt)} (Brisbane time)`,
		url
	]
		.filter(Boolean)
		.join('\n');
	return [
		'BEGIN:VEVENT',
		`UID:${race.id}@runaround.com.au`,
		`DTSTAMP:${formatUtcDate(now)}`,
		`DTSTART;TZID=Australia/Brisbane:${formatBrisbaneDate(race.startsAt)}`,
		`DTEND;TZID=Australia/Brisbane:${formatBrisbaneDate(race.endsAt)}`,
		`SUMMARY:${escapeIcsText(race.title)}`,
		`DESCRIPTION:${escapeIcsText(description)}`,
		`LOCATION:${escapeIcsText(CALENDAR_LOCATION)}`,
		`URL:${url}`,
		'STATUS:CONFIRMED',
		'TRANSP:TRANSPARENT',
		'END:VEVENT'
	];
}

/** Build a complete VCALENDAR document with CRLF line endings. */
export function buildCalendarFeed(opts: {
	origin: string;
	races: CalendarRace[];
	now?: Date;
	name?: string;
	description?: string;
}): string {
	const now = opts.now ?? new Date();
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//RunAround//Race calendar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeIcsText(opts.name ?? CALENDAR_NAME)}`,
		`X-WR-CALDESC:${escapeIcsText(opts.description ?? CALENDAR_DESCRIPTION)}`,
		'X-WR-TIMEZONE:Australia/Brisbane',
		'REFRESH-INTERVAL;VALUE=DURATION:PT24H',
		'X-PUBLISHED-TTL:PT24H',
		// Brisbane has no daylight saving, so one fixed STANDARD component is enough.
		'BEGIN:VTIMEZONE',
		'TZID:Australia/Brisbane',
		'X-LIC-LOCATION:Australia/Brisbane',
		'BEGIN:STANDARD',
		'DTSTART:19700101T000000',
		'TZOFFSETFROM:+1000',
		'TZOFFSETTO:+1000',
		'TZNAME:AEST',
		'END:STANDARD',
		'END:VTIMEZONE',
		...[...opts.races]
			.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
			.flatMap((race) => eventLines(opts.origin, race, now)),
		'END:VCALENDAR'
	];
	return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
