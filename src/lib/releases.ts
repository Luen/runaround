/** Pure helpers for the public release notes page (#151). */

export type ReleaseNote = {
	tag: string;
	name: string;
	publishedAt: string | null;
	url: string;
	body: string;
	prerelease: boolean;
};

type GithubRelease = {
	tag_name?: string;
	name?: string | null;
	published_at?: string | null;
	html_url?: string;
	body?: string | null;
	prerelease?: boolean;
	draft?: boolean;
};

export function parseGithubReleases(payload: unknown): ReleaseNote[] {
	if (!Array.isArray(payload)) return [];
	const out: ReleaseNote[] = [];
	for (const raw of payload) {
		if (!raw || typeof raw !== 'object') continue;
		const r = raw as GithubRelease;
		if (r.draft) continue;
		const tag = typeof r.tag_name === 'string' ? r.tag_name.trim() : '';
		if (!tag) continue;
		out.push({
			tag,
			name: (typeof r.name === 'string' && r.name.trim()) || tag,
			publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
			url:
				typeof r.html_url === 'string'
					? r.html_url
					: `https://github.com/Luen/runaround/releases/tag/${encodeURIComponent(tag)}`,
			body: typeof r.body === 'string' ? r.body.trim() : '',
			prerelease: Boolean(r.prerelease)
		});
	}
	return out;
}

/** Display form of a semver / git tag for the footer (strip leading `v`). */
export function displayVersion(tagOrVersion: string): string {
	const t = tagOrVersion.trim();
	return t.startsWith('v') ? t.slice(1) : t;
}
