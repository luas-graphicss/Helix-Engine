import { SnapshotBuffer } from './snapshot-buffer';
import type { TransformState } from './transform-state';
const HISTORY_CAPACITY = 64;
export class TransformHistory {
    private readonly tracks = new Map<number, SnapshotBuffer>();
    record(objectId: number, timeMs: number, transform: TransformState): void {
        let track = this.tracks.get(objectId);
        if (!track) {
            track = new SnapshotBuffer(HISTORY_CAPACITY);
            this.tracks.set(objectId, track);
        }
        track.push(timeMs, transform, false);
    }
    sample(objectId: number, timeMs: number, target: TransformState): boolean {
        return this.tracks.get(objectId)?.sample(timeMs, target) ?? false;
    }
    forget(objectId: number): void {
        this.tracks.delete(objectId);
    }
}
