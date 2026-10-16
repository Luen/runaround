/**
 * Team-of-N auto-linking from GPS traces (#207).
 *
 * Teams are not pre-registered. Matched attempts on the same race are linked
 * when their on-course efforts start and finish at similar times and the
 * runners stay within `maxSeparationM` of each other the whole way. A group of
 * runners that stayed together (a connected component of that "together"
 * graph, which must also be fully pairwise-together) qualifies only when it has
 * exactly `size` distinct runners. Team time = average of the members' times.
 */
import { haversineMeters } from './geo';

/** Compact on-course trace: [epoch ms, lat, lng]. */
export type TracePoint = [number, number, number];

export type TeamRules = {
	size: number;
	maxSeparationM: number;
	maxStartGapS: number;
	maxFinishGapS: number;
	/** How often (s) to compare positions along the shared effort. */
	sampleEveryS: number;
};

export const DEFAULT_TEAM_RULES: TeamRules = {
	size: 4,
	maxSeparationM: 1000,
	maxStartGapS: 300,
	maxFinishGapS: 300,
	sampleEveryS: 30
};

export type TeamCandidate = {
	attemptId: string;
	/** Stable runner identity (user id or athlete key). */
	participantKey: string;
	name: string;
	timeMs: number;
	trace: TracePoint[];
};

export type TeamResult = {
	rank: number;
	timeMs: number;
	startedAt: Date;
	members: { attemptId: string; participantKey: string; name: string; timeMs: number }[];
};

/** Keep at most one point per `everyS` seconds; always keeps the last point. */
export function downsampleTrace(trace: TracePoint[], everyS = 15): TracePoint[] {
	if (trace.length <= 2) return trace.slice();
	const out: TracePoint[] = [trace[0]];
	for (let i = 1; i < trace.length - 1; i += 1) {
		if (trace[i][0] - out[out.length - 1][0] >= everyS * 1000) out.push(trace[i]);
	}
	out.push(trace[trace.length - 1]);
	return out;
}

/** Linear interpolation of position at time `t` (ms); null outside the trace. */
export function positionAt(trace: TracePoint[], t: number): { lat: number; lng: number } | null {
	if (trace.length === 0 || t < trace[0][0] || t > trace[trace.length - 1][0]) return null;
	let lo = 0;
	let hi = trace.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (trace[mid][0] <= t) lo = mid;
		else hi = mid;
	}
	const a = trace[lo];
	const b = trace[hi];
	const span = b[0] - a[0];
	const f = span > 0 ? (t - a[0]) / span : 0;
	return { lat: a[1] + (b[1] - a[1]) * f, lng: a[2] + (b[2] - a[2]) * f };
}

function bounds(trace: TracePoint[]): [number, number] {
	return [trace[0][0], trace[trace.length - 1][0]];
}

/** Did two efforts start, finish and stay together? */
export function ranTogether(
	a: TracePoint[],
	b: TracePoint[],
	rules: TeamRules = DEFAULT_TEAM_RULES
): boolean {
	if (a.length < 2 || b.length < 2) return false;
	const [as, ae] = bounds(a);
	const [bs, be] = bounds(b);
	if (Math.abs(as - bs) > rules.maxStartGapS * 1000) return false;
	if (Math.abs(ae - be) > rules.maxFinishGapS * 1000) return false;
	const from = Math.max(as, bs);
	const to = Math.min(ae, be);
	if (to <= from) return false;
	const step = rules.sampleEveryS * 1000;
	for (let t = from; ; t += step) {
		const at = Math.min(t, to);
		const pa = positionAt(a, at);
		const pb = positionAt(b, at);
		if (!pa || !pb || haversineMeters(pa, pb) > rules.maxSeparationM) return false;
		if (at === to) break;
	}
	return true;
}

/** Find qualifying teams, fastest first. Each attempt belongs to at most one team. */
export function findTeams(
	candidates: TeamCandidate[],
	rules: TeamRules = DEFAULT_TEAM_RULES
): TeamResult[] {
	const usable = candidates
		.filter((c) => c.trace.length >= 2)
		.sort((x, y) => x.trace[0][0] - y.trace[0][0]);
	const n = usable.length;
	const adj: Set<number>[] = usable.map(() => new Set());
	for (let i = 0; i < n; i += 1) {
		for (let j = i + 1; j < n; j += 1) {
			// Sorted by start: once the start gap is too big, no later j can match i.
			if (usable[j].trace[0][0] - usable[i].trace[0][0] > rules.maxStartGapS * 1000) break;
			if (usable[i].participantKey === usable[j].participantKey) continue;
			if (ranTogether(usable[i].trace, usable[j].trace, rules)) {
				adj[i].add(j);
				adj[j].add(i);
			}
		}
	}

	const seen = new Array<boolean>(n).fill(false);
	const teams: Omit<TeamResult, 'rank'>[] = [];
	for (let i = 0; i < n; i += 1) {
		if (seen[i] || adj[i].size === 0) continue;
		const component: number[] = [];
		const stack = [i];
		seen[i] = true;
		while (stack.length) {
			const k = stack.pop()!;
			component.push(k);
			for (const m of adj[k]) {
				if (!seen[m]) {
					seen[m] = true;
					stack.push(m);
				}
			}
		}
		if (component.length !== rules.size) continue;
		const pairwise = component.every((x) => component.every((y) => x === y || adj[x].has(y)));
		if (!pairwise) continue;
		const members = component.map((k) => usable[k]);
		if (new Set(members.map((m) => m.participantKey)).size !== rules.size) continue;
		teams.push({
			timeMs: Math.round(members.reduce((s, m) => s + m.timeMs, 0) / members.length),
			startedAt: new Date(Math.min(...members.map((m) => m.trace[0][0]))),
			members: members
				.map(({ attemptId, participantKey, name, timeMs }) => ({
					attemptId,
					participantKey,
					name,
					timeMs
				}))
				.sort((x, y) => x.timeMs - y.timeMs)
		});
	}

	return teams
		.sort((a, b) => a.timeMs - b.timeMs || a.startedAt.getTime() - b.startedAt.getTime())
		.map((t, i) => ({ rank: i + 1, ...t }));
}
