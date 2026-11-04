import { describe, expect, it } from 'vitest';
import { displayVersion, parseGithubReleases } from '#lib/releases.js';

describe('parseGithubReleases', () => {
	it('maps published releases and skips drafts', () => {
		const notes = parseGithubReleases([
			{
				tag_name: 'v2.3.3',
				name: 'v2.3.3',
				published_at: '2026-10-15T11:19:17Z',
				html_url: 'https://github.com/Luen/runaround/releases/tag/v2.3.3',
				body: 'Nightly update.',
				prerelease: false,
				draft: false
			},
			{ tag_name: 'v9.9.9', draft: true, body: 'secret' }
		]);
		expect(notes).toEqual([
			{
				tag: 'v2.3.3',
				name: 'v2.3.3',
				publishedAt: '2026-10-15T11:19:17Z',
				url: 'https://github.com/Luen/runaround/releases/tag/v2.3.3',
				body: 'Nightly update.',
				prerelease: false
			}
		]);
	});

	it('returns empty for non-arrays', () => {
		expect(parseGithubReleases(null)).toEqual([]);
		expect(parseGithubReleases({})).toEqual([]);
	});
});

describe('displayVersion', () => {
	it('strips a leading v', () => {
		expect(displayVersion('v2.3.3')).toBe('2.3.3');
		expect(displayVersion('2.3.3')).toBe('2.3.3');
	});
});
