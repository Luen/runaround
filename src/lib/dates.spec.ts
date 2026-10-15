import { describe, expect, it } from 'vitest';
import {
	endOfBrisbaneDay,
	formatDate,
	formatDateRange,
	formatDateTime,
	parseBrisbaneInputValue,
	toBrisbaneInputValue
} from './dates';

describe('Australian dates', () => {
	it('formats day-month-year on Brisbane time', () => {
		expect(formatDate(new Date('2026-10-05T00:00:00Z'))).toBe('5 Oct 2026');
		// 15:00 UTC is already the next day in Brisbane.
		expect(formatDate('2026-10-04T15:00:00Z')).toBe('5 Oct 2026');
		expect(formatDate(Date.UTC(2026, 11, 31, 13, 59))).toBe('31 Dec 2026');
	});

	it('formats date and time', () => {
		expect(formatDateTime('2026-10-05T08:30:00Z')).toBe('5 Oct 2026, 6:30 pm');
	});

	it('formats a range', () => {
		expect(formatDateRange('2026-09-30T14:00:00Z', '2026-10-31T13:59:59Z')).toBe(
			'1 Oct 2026 – 31 Oct 2026'
		);
	});

	it('round-trips datetime-local values as Brisbane time', () => {
		const d = parseBrisbaneInputValue('2026-10-05T06:00');
		expect(d.toISOString()).toBe('2026-10-04T20:00:00.000Z');
		expect(toBrisbaneInputValue(d)).toBe('2026-10-05T06:00');
		expect(parseBrisbaneInputValue('2026-10-05').toISOString()).toBe('2026-10-04T14:00:00.000Z');
		expect(() => parseBrisbaneInputValue('nope')).toThrow();
	});

	it('ends the Brisbane day', () => {
		expect(endOfBrisbaneDay(parseBrisbaneInputValue('2026-10-31T06:00')).toISOString()).toBe(
			'2026-10-31T13:59:59.999Z'
		);
		expect(endOfBrisbaneDay(parseBrisbaneInputValue('2026-10-31T23:30')).toISOString()).toBe(
			'2026-10-31T13:59:59.999Z'
		);
	});
});
