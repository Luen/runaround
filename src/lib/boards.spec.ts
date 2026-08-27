import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { rankedLeaderboard, filterRaceWindow } from './boards';
import { legacySurface } from './legacy';

describe('legacy seed shape', () => {
	it('contains nine races with leaderboards and polylines', () => {
		const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/legacy/database.json');
		const races = JSON.parse(readFileSync(file, 'utf8')) as {
			id: number;
			map?: { polyline?: string };
			leaderboard?: unknown[];
		}[];
		expect(races).toHaveLength(9);
		for (const race of races) {
			expect(race.map?.polyline?.length).toBeGreaterThan(10);
			expect((race.leaderboard ?? []).length).toBeGreaterThan(0);
		}
	});

	it('classifies Castle Hill / trail segments as trail', () => {
		expect(legacySurface('30500288')).toBe('trail');
		expect(legacySurface('27927100')).toBe('trail');
		expect(legacySurface('12345')).toBe('road');
	});
});

describe('leaderboard ranking', () => {
	const windowStart = new Date('2022-01-01T00:00:00Z');
	const windowEnd = new Date('2022-01-31T00:00:00Z');

	it('keeps the best time per person and ranks overall vs in-window separately', () => {
		const rows = [
			{
				id: '1',
				userId: 'a',
				stravaAthleteId: '1',
				timeMs: 900_000,
				startedAt: new Date('2022-01-10T00:00:00Z'),
				importedName: 'Ann',
				source: 'live'
			},
			{
				id: '2',
				userId: 'a',
				stravaAthleteId: '1',
				timeMs: 800_000,
				startedAt: new Date('2022-06-01T00:00:00Z'),
				importedName: 'Ann',
				source: 'live'
			},
			{
				id: '3',
				userId: 'b',
				stravaAthleteId: '2',
				timeMs: 850_000,
				startedAt: new Date('2022-01-12T00:00:00Z'),
				importedName: 'Bob',
				source: 'strava_import'
			}
		];

		const overall = rankedLeaderboard(rows);
		expect(overall.map((r) => r.name)).toEqual(['Ann', 'Bob']);
		expect(overall[0].timeMs).toBe(800_000);

		const raceBoard = rankedLeaderboard(filterRaceWindow(rows, windowStart, windowEnd));
		expect(raceBoard.map((r) => r.name)).toEqual(['Bob', 'Ann']);
		expect(raceBoard[1].timeMs).toBe(900_000);
	});
});
