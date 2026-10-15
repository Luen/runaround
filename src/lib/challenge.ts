import { formatDuration } from './geo';

export type ChallengeInput = {
	raceTitle: string;
	/** Absolute race page URL. */
	url: string;
	/** Challenger's best time on this race, when they have one. */
	timeMs?: number | null;
};

/** Absolute race page URL used in challenge links. */
export function challengeUrl(origin: string, slug: string): string {
	const path = `/races/${encodeURIComponent(slug)}`;
	try {
		return new URL(path, origin).href;
	} catch {
		// Never take the race page down over a share link; fall back to a relative URL.
		return path;
	}
}

/** Invite text without the link (share sheets take the URL separately). */
export function challengeText({ raceTitle, timeMs }: Omit<ChallengeInput, 'url'>): string {
	if (typeof timeMs === 'number' && Number.isFinite(timeMs) && timeMs > 0) {
		return `I just ran ${raceTitle} in ${formatDuration(timeMs)}. Think you can beat me?`;
	}
	return `I'm challenging you to ${raceTitle} on RunAround. Think you can take it on?`;
}

/** Full message for copy-to-clipboard: invite text followed by the link. */
export function challengeMessage(input: ChallengeInput): string {
	return `${challengeText(input)} ${input.url}`;
}
