import type { Coord } from './routing';

type Course = { waypoints: Coord[]; legs: Coord[][] };
export type CourseEditorState = Course & { pending: number; undoCount: number };
const copy = (course: Course): Course => ({
	waypoints: course.waypoints.map((c) => [...c]),
	legs: course.legs.map((leg) => leg.map((c) => [...c]))
});

/** Serialize edits so routing latency cannot reorder legs or overwrite later moves. */
export class CourseEditor {
	private course: Course = { waypoints: [], legs: [] };
	private history: Course[] = [];
	private tail: Promise<void> = Promise.resolve();
	private pending = 0;
	private disposed = false;

	constructor(
		private route: (from: Coord, to: Coord) => Promise<Coord[]>,
		private changed: (state: CourseEditorState) => void
	) {}
	private emit() {
		if (!this.disposed)
			this.changed({ ...copy(this.course), pending: this.pending, undoCount: this.history.length });
	}
	private edit(work: () => Promise<void>) {
		if (this.disposed) return Promise.resolve();
		this.pending++;
		this.emit();
		const result = this.tail
			.then(async () => {
				if (this.disposed) return;
				const previous = copy(this.course);
				this.history.push(previous);
				try {
					await work();
				} catch (error) {
					this.course = previous;
					this.history.pop();
					throw error;
				}
			})
			.finally(() => {
				this.pending--;
				this.emit();
			});
		this.tail = result.catch(() => {});
		return result;
	}
	add(c: Coord) {
		return this.edit(async () => {
			const prev = this.course.waypoints.at(-1);
			this.course.waypoints.push([...c]);
			this.emit();
			if (prev) this.course.legs.push(await this.route(prev, c));
		});
	}
	move(i: number, c: Coord) {
		return this.edit(async () => {
			const next = this.course.waypoints;
			if (!next[i]) return;
			next[i] = [...c];
			this.emit();
			const jobs: Promise<void>[] = [];
			if (i > 0)
				jobs.push(
					this.route(next[i - 1], c).then((leg) => {
						this.course.legs[i - 1] = leg;
					})
				);
			if (i < next.length - 1)
				jobs.push(
					this.route(c, next[i + 1]).then((leg) => {
						this.course.legs[i] = leg;
					})
				);
			// Wait for all legs even if one fails, before the next queued edit starts.
			const results = await Promise.allSettled(jobs);
			const failure = results.find((r) => r.status === 'rejected');
			if (failure?.status === 'rejected') throw failure.reason;
		});
	}
	undo() {
		if (this.pending || this.disposed) return;
		const previous = this.history.pop();
		if (previous) this.course = previous;
		this.emit();
	}
	clear() {
		if (this.pending || this.disposed || !this.course.waypoints.length) return;
		this.history.push(copy(this.course));
		this.course = { waypoints: [], legs: [] };
		this.emit();
	}
	dispose() {
		this.disposed = true;
	}
}
