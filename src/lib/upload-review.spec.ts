import { describe, expect, it } from 'vitest';
import type { ParsedActivity } from './activity-file';
import { reviewUpload } from './upload-review';

function activity(overrides: Partial<ParsedActivity> = {}): ParsedActivity {
	return {
		name: 'Run',
		startedAt: new Date('2026-01-01T00:00:00Z'),
		elapsedS: 1800,
		distanceM: 5000,
		timed: [
			{ point: { lat: -19.3, lng: 146.75 }, t: 0 },
			{ point: { lat: -19.29, lng: 146.75 }, t: 900 },
			{ point: { lat: -19.28, lng: 146.75 }, t: 1800 }
		],
		...overrides
	};
}

describe('reviewUpload (#248)', () => {
	it('accepts a plausible run', () => {
		expect(reviewUpload(activity())).toBeNull();
	});
	it('flags an implausible average pace', () => {
		const reason = reviewUpload(activity({ elapsedS: 300, distanceM: 5000 }));
		expect(reason).toMatch(/implausibly fast/i);
	});
	it('ignores a single GPS glitch but flags repeated jumps', () => {
		const single = activity({
			timed: [
				{ point: { lat: -19.3, lng: 146.75 }, t: 0 },
				{ point: { lat: -19.2, lng: 146.75 }, t: 5 },
				{ point: { lat: -19.199, lng: 146.75 }, t: 905 }
			]
		});
		expect(reviewUpload(single)).toBeNull();
		const repeated = activity({
			timed: [
				{ point: { lat: -19.3, lng: 146.75 }, t: 0 },
				{ point: { lat: -19.2, lng: 146.75 }, t: 5 },
				{ point: { lat: -19.1, lng: 146.75 }, t: 10 }
			]
		});
		expect(reviewUpload(repeated)).toMatch(/GPS jumps/);
	});
	it('flags a track already uploaded by another runner', () => {
		expect(reviewUpload(activity(), { duplicateByOtherRunner: true })).toMatch(/another runner/);
	});
});
