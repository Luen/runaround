/**
 * Monthly newsletter and new-race announcements (#168).
 *
 * Consent is explicit: runners opt in on the email-first login form, the Strava
 * email onboarding step, or /me. Each issue is recorded per runner in
 * `newsletter_sends`, so worker retries never send the same issue twice.
 */
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { jobs, newsletterPendingOptIns, newsletterSends, races, user } from './db/schema';
import { enqueueJob } from './jobs';
import { raceLeaderboard } from './leaderboard';
import { effectiveRaceStatus } from '../matching';
import { resultsHidden } from '../reveal';
import { isPlaceholderEmail } from './identity';
import {
	monthlyIssue,
	monthlySendAt,
	newRaceIssue,
	nextMonthlySendAt,
	type NewsletterDigest,
	type NewsletterKind
} from '../newsletter';
export { newsletterUnsubscribeUrl, verifyNewsletterUnsubscribe } from './newsletter-link';

/** Remember consent until the magic-link user row exists. */
export async function rememberPendingNewsletterOptIn(email: string): Promise<void> {
	await db
		.insert(newsletterPendingOptIns)
		.values({ email: email.trim().toLowerCase() })
		.onConflictDoNothing();
}

export async function forgetPendingNewsletterOptIn(email: string): Promise<void> {
	await db
		.delete(newsletterPendingOptIns)
		.where(eq(newsletterPendingOptIns.email, email.trim().toLowerCase()));
}

/** Apply consent collected before sign-in. Returns true when it was claimed. */
export async function claimPendingNewsletterOptIn(userId: string, email: string): Promise<boolean> {
	const normalized = email.trim().toLowerCase();
	const [pending] = await db
		.select({ email: newsletterPendingOptIns.email })
		.from(newsletterPendingOptIns)
		.where(
			and(
				eq(newsletterPendingOptIns.email, normalized),
				// A magic link lasts 15 minutes; ignore abandoned consent from long ago.
				gte(newsletterPendingOptIns.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
			)
		)
		.limit(1);
	if (!pending) return false;
	await db
		.update(user)
		.set({ newsletterOptIn: true, newsletterOptInAt: new Date() })
		.where(eq(user.id, userId));
	await forgetPendingNewsletterOptIn(normalized);
	return true;
}

export async function setNewsletterOptIn(userId: string, enabled: boolean): Promise<void> {
	await db
		.update(user)
		.set({ newsletterOptIn: enabled, newsletterOptInAt: enabled ? new Date() : null })
		.where(eq(user.id, userId));
}

/** Queue an issue unless a pending, running or already-sent job has the same issue key. */
export async function enqueueNewsletterOnce(
	issue: string,
	kind: NewsletterKind,
	runAt: Date = new Date(),
	extra: Record<string, unknown> = {}
): Promise<boolean> {
	const [existing] = await db
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				eq(jobs.type, 'newsletter'),
				inArray(jobs.status, ['pending', 'running', 'done']),
				sql`${jobs.payload}->>'issue' = ${issue}`
			)
		)
		.limit(1);
	if (existing) return false;
	await enqueueJob('newsletter', { issue, kind, ...extra }, runAt);
	return true;
}

/**
 * Make sure this month's issue is queued (or sent) and next month's is queued.
 * Called at worker start and after every newsletter job, so a restart or a long
 * outage cannot skip a month.
 */
export async function ensureMonthlyNewsletter(now: Date = new Date()): Promise<void> {
	const due = monthlySendAt(now);
	const thisMonth = monthlyIssue(now);
	await enqueueNewsletterOnce(thisMonth, 'monthly', now < due ? due : now);
	const next = nextMonthlySendAt(now);
	await enqueueNewsletterOnce(monthlyIssue(next), 'monthly', next);
}

/** Trigger a prompt announcement after a race is published. */
export async function enqueueNewRaceNewsletter(
	race: { slug: string; title: string },
	now: Date = new Date()
): Promise<boolean> {
	return enqueueNewsletterOnce(newRaceIssue(race.slug, now), 'new_race', now, {
		raceSlug: race.slug,
		raceTitle: race.title
	});
}

/** JSON-safe digest for job payloads (Dates → ISO strings). */
export function serializeNewsletterDigest(digest: NewsletterDigest) {
	return {
		upcoming: digest.upcoming.map((race) => ({
			...race,
			startsAt: race.startsAt.toISOString(),
			endsAt: race.endsAt.toISOString()
		})),
		winners: digest.winners
	};
}

export function reviveNewsletterDigest(raw: unknown): NewsletterDigest | null {
	if (!raw || typeof raw !== 'object') return null;
	const upcoming = (raw as { upcoming?: unknown }).upcoming;
	const winners = (raw as { winners?: unknown }).winners;
	if (!Array.isArray(upcoming) || !Array.isArray(winners)) return null;
	return {
		upcoming: upcoming.map((race) => {
			const r = race as NewsletterDigest['upcoming'][number] & {
				startsAt: string | Date;
				endsAt: string | Date;
			};
			return {
				slug: String(r.slug),
				title: String(r.title),
				surface: String(r.surface),
				distanceM: Number(r.distanceM),
				startsAt: new Date(r.startsAt),
				endsAt: new Date(r.endsAt)
			};
		}),
		winners: winners as NewsletterDigest['winners']
	};
}

/** Upcoming/live races plus top-three finishers from races closed in the last month. */
export async function buildNewsletterDigest(now: Date = new Date()): Promise<NewsletterDigest> {
	const all = await db.select().from(races);
	const upcoming = all
		.filter((race) => race.status !== 'draft' && effectiveRaceStatus(race, now) !== 'closed')
		.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
		.slice(0, 5)
		.map((race) => ({
			slug: race.slug,
			title: race.title,
			surface: race.surface,
			distanceM: race.distanceM,
			startsAt: race.startsAt,
			endsAt: race.endsAt
		}));

	const monthAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
	const recent = all
		.filter(
			(race) =>
				race.status !== 'draft' &&
				race.endsAt < now &&
				race.endsAt >= monthAgo &&
				!resultsHidden(race, now)
		)
		.sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())
		.slice(0, 5);

	const winners: NewsletterDigest['winners'] = [];
	for (const race of recent) {
		const board = await raceLeaderboard(race.id);
		for (const row of board.slice(0, 3)) {
			winners.push({
				slug: race.slug,
				raceTitle: race.title,
				name: row.name,
				rank: row.rank,
				timeMs: row.timeMs
			});
		}
	}
	return { upcoming, winners };
}

/**
 * Enqueue one `send_email` job per opted-in runner. Per-runner delivery is
 * idempotent (and retryable) through `newsletter_sends`.
 */
export async function sendNewsletterIssue(payload: Record<string, unknown>): Promise<number> {
	const issue = String(payload.issue ?? '').trim();
	if (!issue) return 0;
	const kind: NewsletterKind = payload.kind === 'monthly' ? 'monthly' : 'new_race';

	const recipients = await db
		.select({ id: user.id, email: user.email })
		.from(user)
		.where(and(eq(user.newsletterOptIn, true), eq(user.needsEmail, false)));
	const sent = new Set(
		(
			await db
				.select({ userId: newsletterSends.userId })
				.from(newsletterSends)
				.where(eq(newsletterSends.issue, issue))
		).map((row) => row.userId)
	);

	// Build once per issue so every recipient shares the same content and we
	// avoid N races+leaderboard scans during a bulk send.
	const digest = await buildNewsletterDigest();
	const raceSlug = typeof payload.raceSlug === 'string' ? payload.raceSlug : null;
	const raceTitle = typeof payload.raceTitle === 'string' ? payload.raceTitle : null;
	if (kind === 'new_race' && raceSlug) {
		const featured = digest.upcoming.find((race) => race.slug === raceSlug);
		if (featured) {
			digest.upcoming = [featured, ...digest.upcoming.filter((race) => race.slug !== raceSlug)];
		} else if (raceTitle) {
			digest.upcoming = [
				{
					slug: raceSlug,
					title: raceTitle,
					surface: 'road',
					distanceM: 0,
					startsAt: new Date(),
					endsAt: new Date()
				},
				...digest.upcoming
			];
		}
	}

	const digestPayload = serializeNewsletterDigest(digest);
	let queued = 0;
	for (const runner of recipients) {
		if (!runner.email || isPlaceholderEmail(runner.email) || sent.has(runner.id)) continue;
		await enqueueJob('send_email', {
			kind: 'newsletter',
			userId: runner.id,
			issue,
			issueKind: kind,
			digest: digestPayload,
			featuredRaceTitle: raceTitle
		});
		queued += 1;
	}
	return queued;
}
