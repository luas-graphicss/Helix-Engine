import { cloneTransformState, copyTransformState, interpolateTransform, type TransformState } from './transform-state';
interface Snapshot {
    readonly timeMs: number;
    readonly transform: TransformState;
    readonly teleported: boolean;
}
const DEFAULT_CAPACITY = 32;
const MAX_EXTRAPOLATION_MS = 120;
export class SnapshotBuffer {
    private readonly snapshots: Snapshot[] = [];
    constructor(private readonly capacity = DEFAULT_CAPACITY) { }
    get latestTimeMs(): number | null {
        return this.snapshots.at(-1)?.timeMs ?? null;
    }
    push(timeMs: number, transform: TransformState, teleported: boolean): void {
        let index = this.snapshots.length;
        while (index > 0 && this.snapshots[index - 1].timeMs > timeMs)
            index--;
        if (index > 0 && this.snapshots[index - 1].timeMs === timeMs)
            return;
        if (index === 0 && this.snapshots.length >= this.capacity)
            return;
        this.snapshots.splice(index, 0, { timeMs, transform: cloneTransformState(transform), teleported });
        if (this.snapshots.length > this.capacity)
            this.snapshots.shift();
    }
    sample(timeMs: number, target: TransformState): boolean {
        const { snapshots } = this;
        const newest = snapshots.at(-1);
        if (!newest)
            return false;
        if (timeMs >= newest.timeMs) {
            this.extrapolate(timeMs, target, newest, snapshots.at(-2));
            return true;
        }
        const oldest = snapshots[0];
        if (timeMs <= oldest.timeMs) {
            copyTransformState(target, oldest.transform);
            return true;
        }
        let index = snapshots.length - 2;
        while (index > 0 && snapshots[index].timeMs > timeMs)
            index--;
        const from = snapshots[index];
        const to = snapshots[index + 1];
        if (timeMs <= from.timeMs || to.teleported) {
            copyTransformState(target, from.transform);
            return true;
        }
        interpolateTransform(target, from.transform, to.transform, (timeMs - from.timeMs) / (to.timeMs - from.timeMs));
        return true;
    }
    clear(): void {
        this.snapshots.length = 0;
    }
    private extrapolate(timeMs: number, target: TransformState, newest: Snapshot, previous: Snapshot | undefined): void {
        copyTransformState(target, newest.transform);
        if (!previous || newest.teleported)
            return;
        const span = newest.timeMs - previous.timeMs;
        const ahead = Math.min(MAX_EXTRAPOLATION_MS, timeMs - newest.timeMs);
        if (span <= 0 || ahead <= 0)
            return;
        for (let axis = 0; axis < 3; axis++)
            target.position[axis] += ((newest.transform.position[axis] - previous.transform.position[axis]) / span) * ahead;
    }
}
