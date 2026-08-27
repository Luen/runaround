export const TRAIL_SEGMENT_IDS = new Set([
	'27927100',
	'28927372',
	'30354222',
	'30361147',
	'30500288',
	'30561161'
]);

export function legacySurface(slug: string): 'road' | 'trail' {
	return TRAIL_SEGMENT_IDS.has(slug) ? 'trail' : 'road';
}
