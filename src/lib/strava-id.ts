/**
 * Strava id helpers (#298).
 *
 * From June 1, 2027 Strava may return 64-bit activity/athlete ids. JavaScript
 * numbers are only exact up to 2^53-1, and `JSON.parse` silently rounds larger
 * integers, so `id_str` must win whenever Strava sends it.
 */

export type StravaIdentified = { id: number | string; id_str?: string | null };

/** Exact string id: prefer `id_str`; current numeric ids are safe to stringify. */
export function stravaId(value: StravaIdentified): string {
	return value.id_str ?? String(value.id);
}

export type StravaWebhookEvent = {
	object_type?: string;
	aspect_type?: string;
	object_id?: string;
	owner_id?: string;
	updates?: Record<string, unknown>;
};

// Webhook payloads carry `object_id`/`owner_id` as bare JSON numbers with no
// `id_str` (unlike the REST API), so JSON.parse would round a 64-bit id before
// we ever see it. Quote just those two fields first to keep every digit.
const RAW_ID_FIELD = /("(?:object_id|owner_id)"\s*:\s*)(-?\d+)(?=\s*[,}])/g;

/** Parse a Strava webhook body without losing 64-bit ids (#298). */
export function parseStravaWebhookBody(raw: string): StravaWebhookEvent {
	try {
		return JSON.parse(raw.replace(RAW_ID_FIELD, '$1"$2"')) as StravaWebhookEvent;
	} catch {
		return {};
	}
}
