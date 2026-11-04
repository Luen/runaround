import { describe, expect, it } from 'vitest';
import { raceEditable } from './race-edit';

const now = new Date('2027-06-01T00:00:00Z');

describe('raceEditable', () => {
	it('allows draft, upcoming and live races that have not ended', () => {
		for (const status of ['draft', 'upcoming', 'live']) {
			expect(raceEditable({ status, endsAt: new Date('2027-12-31T13:59:59Z') }, now)).toBe(true);
		}
	});
	it('locks closed races even if the end date is in the future', () => {
		expect(raceEditable({ status: 'closed', endsAt: '2028-01-01T00:00:00Z' }, now)).toBe(false);
	});
	it('locks races whose window has ended even if status is stale', () => {
		expect(raceEditable({ status: 'live', endsAt: '2027-05-31T23:59:59Z' }, now)).toBe(false);
	});
	it('still allows editing at the exact end instant', () => {
		expect(raceEditable({ status: 'live', endsAt: now }, now)).toBe(true);
	});
});
