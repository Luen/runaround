/**
 * Shared date formatting. RunAround is a Townsville site, so every date is shown
 * in Australian format on Brisbane time (AEST, UTC+10, no daylight saving).
 * Fixing locale + time zone makes SSR (Vercel runs in UTC/en-US) and the browser
 * render the same text, avoiding hydration mismatches.
 */

export const SITE_LOCALE = 'en-AU';
export const SITE_TIME_ZONE = 'Australia/Brisbane';
/** Brisbane has no DST, so the offset is constant. */
const BRISBANE_OFFSET = '+10:00';
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

type DateInput = Date | string | number;

const dateFormat = new Intl.DateTimeFormat(SITE_LOCALE, {
	timeZone: SITE_TIME_ZONE,
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});

const dateTimeFormat = new Intl.DateTimeFormat(SITE_LOCALE, {
	timeZone: SITE_TIME_ZONE,
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	hour12: true
});

const partsFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: SITE_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

function toDate(value: DateInput): Date {
	return value instanceof Date ? value : new Date(value);
}

/** e.g. "5 Oct 2026" */
export function formatDate(value: DateInput): string {
	return dateFormat.format(toDate(value));
}

/** e.g. "5 Oct 2026, 6:30 pm" */
export function formatDateTime(value: DateInput): string {
	return dateTimeFormat.format(toDate(value));
}

/** e.g. "1 Oct 2026 – 31 Oct 2026" */
export function formatDateRange(start: DateInput, end: DateInput): string {
	return `${formatDate(start)} – ${formatDate(end)}`;
}

/** `<input type="datetime-local">` value (YYYY-MM-DDTHH:mm) in Brisbane time. */
export function toBrisbaneInputValue(value: DateInput): string {
	const parts = Object.fromEntries(
		partsFormat.formatToParts(toDate(value)).map((p) => [p.type, p.value])
	);
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Parse a datetime-local / date value as Brisbane time (server TZ independent). */
export function parseBrisbaneInputValue(value: string): Date {
	const trimmed = value.trim();
	const withTime = /T\d{2}:\d{2}/.test(trimmed) ? trimmed : `${trimmed}T00:00`;
	const withSeconds = /T\d{2}:\d{2}$/.test(withTime) ? `${withTime}:00` : withTime;
	const date = new Date(`${withSeconds}${BRISBANE_OFFSET}`);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
	return date;
}

/** 23:59:59.999 Brisbane time on the Brisbane calendar day containing `value`. */
export function endOfBrisbaneDay(value: DateInput): Date {
	const shifted = new Date(toDate(value).getTime() + BRISBANE_OFFSET_MS);
	shifted.setUTCHours(23, 59, 59, 999);
	return new Date(shifted.getTime() - BRISBANE_OFFSET_MS);
}
