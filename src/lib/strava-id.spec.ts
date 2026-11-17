import { describe, expect, it } from 'vitest';
import { parseStravaWebhookBody, stravaId } from './strava-id';

describe('stravaId', () => {
	it('prefers id_str so 64-bit ids stay exact', () => {
		expect(stravaId({ id: 9007199254740992, id_str: '9007199254740993' })).toBe('9007199254740993');
	});

	it('falls back to the numeric id when id_str is absent', () => {
		expect(stravaId({ id: 154504250376823 })).toBe('154504250376823');
	});

	it('accepts string ids', () => {
		expect(stravaId({ id: '123' })).toBe('123');
	});
});

describe('parseStravaWebhookBody', () => {
	it('keeps ids above 2^53 exact', () => {
		const event = parseStravaWebhookBody(
			'{"aspect_type":"create","object_type":"activity","object_id":1234567890987654321,"owner_id":9007199254740993}'
		);
		expect(event.object_id).toBe('1234567890987654321');
		expect(event.owner_id).toBe('9007199254740993');
	});

	it('leaves ordinary numeric ids unchanged', () => {
		const event = parseStravaWebhookBody('{"object_id":1360128428,"owner_id":134815}');
		expect(event.object_id).toBe('1360128428');
		expect(event.owner_id).toBe('134815');
	});

	it('leaves ids that are already strings alone', () => {
		const event = parseStravaWebhookBody(
			'{"object_id":"1234567890987654321","owner_id":"9007199254740993"}'
		);
		expect(event.object_id).toBe('1234567890987654321');
		expect(event.owner_id).toBe('9007199254740993');
	});

	it('returns an empty event for malformed bodies', () => {
		expect(parseStravaWebhookBody('not json')).toEqual({});
	});
});
