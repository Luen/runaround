import { describe, expect, it, vi } from 'vitest';
import { CourseEditor, type CourseEditorState } from './course-editor';
import { joinLegs, type Coord } from './routing';

const a: Coord = [146.75, -19.3],
	b: Coord = [146.76, -19.3],
	c: Coord = [146.77, -19.3];
function deferred() {
	let resolve!: (coords: Coord[]) => void;
	const promise = new Promise<Coord[]>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

describe('course editor routing order', () => {
	it('queues rapid clicks and stays pending until every queued leg is complete', async () => {
		const ab = deferred(),
			bc = deferred();
		const route = vi.fn().mockReturnValueOnce(ab.promise).mockReturnValueOnce(bc.promise);
		let state!: CourseEditorState;
		const editor = new CourseEditor(route, (value) => {
			state = value;
		});
		await editor.add(a);
		const addingB = editor.add(b),
			addingC = editor.add(c);
		await vi.waitFor(() => expect(route).toHaveBeenCalledTimes(1));
		// A would-be faster response for BC cannot append ahead of AB.
		bc.resolve([b, c]);
		expect(state.pending).toBe(2);
		editor.undo();
		editor.clear();
		expect(state.waypoints).toEqual([a, b]);
		ab.resolve([a, b]);
		await Promise.all([addingB, addingC]);
		expect(joinLegs(state.legs)).toEqual([a, b, c]);
		expect(state.pending).toBe(0);
		editor.undo();
		expect(state.waypoints).toEqual([a, b]);
	});
	it('serializes overlapping moves so older routes cannot replace the final geometry', async () => {
		const delayed = deferred();
		let delay = false;
		let state!: CourseEditorState;
		const editor = new CourseEditor(
			async (from, to) => (delay ? delayed.promise : [from, to]),
			(value) => {
				state = value;
			}
		);
		await editor.add(a);
		await editor.add(b);
		await editor.add(c);
		delay = true;
		const first = editor.move(1, [146.761, -19.3]);
		await Promise.resolve();
		const second = editor.move(1, [146.762, -19.3]);
		delay = false;
		delayed.resolve([a, b]);
		await Promise.all([first, second]);
		expect(joinLegs(state.legs)).toEqual([a, [146.762, -19.3], c]);
		expect(state.pending).toBe(0);
	});
	it('ignores in-flight results after the editor is unmounted', async () => {
		const leg = deferred();
		const changed = vi.fn();
		const editor = new CourseEditor(() => leg.promise, changed);
		await editor.add(a);
		const adding = editor.add(b);
		await Promise.resolve();
		editor.dispose();
		changed.mockClear();
		leg.resolve([a, b]);
		await adding;
		expect(changed).not.toHaveBeenCalled();
	});
});
