import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	race: {
		id: 'race',
		status: 'live',
		endsAt: new Date('2027-01-01'),
		resultsRevealAt: new Date('2027-02-01'),
		raceEndEmailsSentAt: null as Date | null
	}
}));
vi.mock('./db', () => ({
	db: {
		select: () => ({ from: async () => [state.race] }),
		update: () => ({
			set: (values: object) => ({ where: async () => Object.assign(state.race, values) })
		})
	}
}));
vi.mock('./leaderboard', () => ({
	raceLeaderboard: vi.fn(async () => [{ userId: 'runner', rank: 1, timeMs: 60_000 }]),
	overallLeaderboard: vi.fn()
}));
vi.mock('./jobs', () => ({ enqueueJob: vi.fn() }));
import { enqueueJob } from './jobs';
import { sendRaceEndEmails } from './sync';

describe('race closure with a results embargo', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2027-01-02'));
		Object.assign(state.race, { status: 'live', raceEndEmailsSentAt: null });
		vi.clearAllMocks();
	});
	afterEach(() => vi.useRealTimers());
	it('closes at the end date, then sends emails once at reveal', async () => {
		await sendRaceEndEmails();
		expect(state.race.status).toBe('closed');
		expect(state.race.raceEndEmailsSentAt).toBeNull();
		expect(enqueueJob).not.toHaveBeenCalled();
		vi.setSystemTime(new Date('2027-02-01'));
		await sendRaceEndEmails();
		expect(enqueueJob).toHaveBeenCalledExactlyOnceWith(
			'send_email',
			expect.objectContaining({ kind: 'race_ended' })
		);
		expect(state.race.raceEndEmailsSentAt).toEqual(new Date('2027-02-01'));
		await sendRaceEndEmails();
		expect(enqueueJob).toHaveBeenCalledTimes(1);
	});
	it('does not close before the inclusive race window ends', async () => {
		vi.setSystemTime(state.race.endsAt);
		await sendRaceEndEmails();
		expect(state.race.status).toBe('live');
		expect(enqueueJob).not.toHaveBeenCalled();
	});
});
