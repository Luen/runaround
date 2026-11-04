import { parseGithubReleases } from '#lib/releases.js';
import type { PageServerLoad } from './$types';

const GITHUB_RELEASES = 'https://api.github.com/repos/Luen/runaround/releases?per_page=30';

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300, s-maxage=900' });
	try {
		const res = await fetch(GITHUB_RELEASES, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': 'runaround.com.au',
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
		if (!res.ok) {
			console.error('GitHub releases fetch failed', res.status);
			return { releases: [], fetchError: true as const };
		}
		const payload: unknown = await res.json();
		return { releases: parseGithubReleases(payload), fetchError: false as const };
	} catch (err) {
		console.error(err);
		return { releases: [], fetchError: true as const };
	}
};
