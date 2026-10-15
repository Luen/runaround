import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	rankedLeaderboard,
	filterRaceWindow,
	safeHttpUrl,
	sortRankedRows,
	defaultSortDir
} from './boards';
import { legacySurface } from './legacy';

describe('legacy seed shape', () => {
	it('contains nine races with leaderboards and polylines', () => {
		const file = resolve(
			dirname(fileURLToPath(import.meta.url)),
			'../../data/legacy/database.json'
		);
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
				source: 'live',
				effortUrl: 'https://www.strava.com/activities/1'
			},
			{
				id: '2',
				userId: 'a',
				stravaAthleteId: '1',
				timeMs: 800_000,
				startedAt: new Date('2022-06-01T00:00:00Z'),
				importedName: 'Ann',
				source: 'live',
				effortUrl: 'https://www.strava.com/activities/2'
			},
			{
				id: '3',
				userId: 'b',
				stravaAthleteId: '2',
				timeMs: 850_000,
				startedAt: new Date('2022-01-12T00:00:00Z'),
				importedName: 'Bob',
				source: 'strava_import',
				effortUrl: null
			}
		];

		const overall = rankedLeaderboard(rows);
		expect(overall.map((r) => r.name)).toEqual(['Ann', 'Bob']);
		expect(overall[0].timeMs).toBe(800_000);
		expect(overall[0].effortUrl).toBe('https://www.strava.com/activities/2');
		expect(overall[1].effortUrl).toBeNull();

		const raceBoard = rankedLeaderboard(filterRaceWindow(rows, windowStart, windowEnd));
		expect(raceBoard.map((r) => r.name)).toEqual(['Bob', 'Ann']);
		expect(raceBoard[1].timeMs).toBe(900_000);
		expect(raceBoard[1].effortUrl).toBe('https://www.strava.com/activities/1');
	});
});

describe('safeHttpUrl', () => {
	it('allows http(s) and rejects unsafe schemes', () => {
		expect(safeHttpUrl('https://www.strava.com/activities/1')).toBe(
			'https://www.strava.com/activities/1'
		);
		expect(safeHttpUrl('http://example.com/x')).toBe('http://example.com/x');
		expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
		expect(safeHttpUrl('data:text/html,hi')).toBeNull();
		expect(safeHttpUrl('/relative')).toBeNull();
		expect(safeHttpUrl(null)).toBeNull();
		expect(safeHttpUrl('')).toBeNull();
		expect(safeHttpUrl('  ')).toBeNull();
	});
});

describe('completions and sorting', () => {
	const base = { stravaAthleteId: null, importedName: null, source: 'live', effortUrl: null };
	const rows = [
		{ ...base, id: '1', userId: 'a', timeMs: 900, startedAt: new Date('2024-01-01') },
		{ ...base, id: '2', userId: 'a', timeMs: 800, startedAt: new Date('2024-01-02') },
		{ ...base, id: '3', userId: 'a', timeMs: 950, startedAt: new Date('2024-01-03') },
		{ ...base, id: '4', userId: 'b', timeMs: 700, startedAt: new Date('2024-01-04') }
	];

	it('counts every completed attempt per runner', () => {
		const board = rankedLeaderboard(rows);
		expect(board.map((r) => [r.userId, r.completions])).toEqual([
			['b', 1],
			['a', 3]
		]);
	});

	it('sorts by time and completions in both directions, keeping place', () => {
		const board = rankedLeaderboard(rows);
		expect(sortRankedRows(board, 'completions', 'desc').map((r) => r.rank)).toEqual([2, 1]);
		expect(sortRankedRows(board, 'completions', 'asc').map((r) => r.rank)).toEqual([1, 2]);
		expect(sortRankedRows(board, 'time', 'desc').map((r) => r.rank)).toEqual([2, 1]);
		expect(sortRankedRows(board, 'rank', 'asc').map((r) => r.rank)).toEqual([1, 2]);
		expect(defaultSortDir('completions')).toBe('desc');
		expect(defaultSortDir('time')).toBe('asc');
	});
});
