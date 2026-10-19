/**
 * Pure newsletter helpers (#168): issue keys, Brisbane send times and the email
 * body. Kept free of database/env imports so the worker and unit tests can use
 * them without a Postgres connection.
 */
import { formatDateRange, toBrisbaneInputValue } from './dates';
import { formatDuration } from './geo';

export type NewsletterKind = 'monthly' | 'new_race';

export type NewsletterDigest = {
	upcoming: {
		slug: string;
		title: string;
		surface: string;
		distanceM: number;
		startsAt: Date;
		endsAt: Date;
	}[];
	winners: {
		slug: string;
		raceTitle: string;
		name: string;
		rank: number;
		timeMs: number;
	}[];
};

function brisbaneMonth(now: Date): string {
	return toBrisbaneInputValue(now).slice(0, 7);
}

/** e.g. `monthly-2026-10`. */
export function monthlyIssue(now: Date = new Date()): string {
	return `monthly-${brisbaneMonth(now)}`;
}

/** First of the month at 08:00 Brisbane (UTC+10, no DST). */
export function monthlySendAt(now: Date = new Date()): Date {
	const [year, month] = brisbaneMonth(now).split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, 1, 8 - 10));
}

/** This month's send if it is still ahead, otherwise next month's. */
export function nextMonthlySendAt(now: Date = new Date()): Date {
	const thisMonth = monthlySendAt(now);
	if (now < thisMonth) return thisMonth;
	const [year, month] = brisbaneMonth(now).split('-').map(Number);
	// Date.UTC rolls December (month = 12) into January next year.
	return new Date(Date.UTC(year, month, 1, 8 - 10));
}

/** Announcements published on the same Brisbane day collapse into one email. */
export function newRaceIssue(now: Date = new Date()): string {
	return `races-${toBrisbaneInputValue(now).slice(0, 10)}`;
}

function escapeHtml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function newsletterEmail(opts: {
	name: string;
	kind: NewsletterKind;
	digest: NewsletterDigest;
	unsubscribeUrl: string;
	origin: string;
}): { subject: string; html: string; text: string } {
	const { name, kind, digest, unsubscribeUrl, origin } = opts;
	const subject =
		kind === 'monthly'
			? 'Your RunAround monthly — races and recent results'
			: digest.upcoming[0]
				? `New RunAround race: ${digest.upcoming[0].title}`
				: 'A new RunAround race is open';

	const raceLines = digest.upcoming.map(
		(race) =>
			`${race.title} — ${formatDateRange(race.startsAt, race.endsAt)} (${Math.round(race.distanceM / 100) / 10} km, ${race.surface})`
	);
	const winnerLines = digest.winners.map(
		(w) => `${w.raceTitle} — ${w.rank}. ${w.name}, ${formatDuration(w.timeMs)}`
	);

	const lines = [
		`Hi ${name},`,
		'',
		kind === 'monthly'
			? 'Here is what is happening at RunAround.'
			: 'A new race is open at RunAround.',
		''
	];
	if (raceLines.length > 0) {
		lines.push('Upcoming and live races:', ...raceLines.map((line) => `• ${line}`), '');
	} else {
		lines.push('No races are open right now — watch the calendar for the next one.', '');
	}
	if (winnerLines.length > 0) {
		lines.push('Recent race winners:', ...winnerLines.map((line) => `• ${line}`), '');
	}
	lines.push(
		'Match a run with Strava, Garmin Connect, or a GPX upload.',
		`All races: ${origin}/races`,
		'',
		`Unsubscribe from the newsletter: ${unsubscribeUrl}`,
		'You are receiving this because you opted in to RunAround news.'
	);
	const text = lines.join('\n');

	const raceHtml = digest.upcoming
		.map(
			(race) =>
				`<li><a href="${origin}/races/${encodeURIComponent(race.slug)}">${escapeHtml(race.title)}</a> — ${escapeHtml(formatDateRange(race.startsAt, race.endsAt))} (${Math.round(race.distanceM / 100) / 10} km, ${escapeHtml(race.surface)})</li>`
		)
		.join('');
	const winnerHtml = digest.winners
		.map(
			(w) =>
				`<li>${escapeHtml(w.raceTitle)} — ${w.rank}. ${escapeHtml(w.name)}, ${escapeHtml(formatDuration(w.timeMs))}</li>`
		)
		.join('');
	const html = `<p>Hi ${escapeHtml(name)},</p>
<p>${kind === 'monthly' ? 'Here is what is happening at RunAround.' : 'A new race is open at RunAround.'}</p>
${raceHtml ? `<h2>Upcoming and live races</h2><ul>${raceHtml}</ul>` : '<p>No races are open right now — watch the calendar for the next one.</p>'}
${winnerHtml ? `<h2>Recent race winners</h2><ul>${winnerHtml}</ul>` : ''}
<p>Match a run with Strava, Garmin Connect, or a GPX upload. <a href="${origin}/races">See all races</a>.</p>
<p style="font-size:12px;color:#57534e">You are receiving this because you opted in to RunAround news. <a href="${unsubscribeUrl.replaceAll('&', '&amp;')}">Unsubscribe</a>.</p>`;

	return { subject, html, text };
}
