import type { JobSystemSnapshot } from '@/engine/jobs/system/job-system';
export interface LoadSample {
    readonly at: number;
    readonly busyMs: readonly number[];
}
export interface LoadBucket {
    readonly at: number;
    readonly load: number;
}
export interface JobMonitor {
    readonly snapshot: JobSystemSnapshot;
    readonly samples: readonly LoadSample[];
}
export const LOAD_BUCKETS = 50;
export const QUIET_AFTER_MS = 10000;
function sampleOf(snapshot: JobSystemSnapshot): LoadSample {
    return { at: snapshot.now, busyMs: snapshot.threads.map((thread) => thread.busyMs) };
}
function isQuiet(snapshot: JobSystemSnapshot): boolean {
    return snapshot.running + snapshot.queued + snapshot.waiting === 0 && snapshot.now - snapshot.lastActivityAt > QUIET_AFTER_MS;
}
function showsSamePicture(previous: JobSystemSnapshot, next: JobSystemSnapshot): boolean {
    return previous.history === next.history && previous.threadCount === next.threadCount && previous.mode === next.mode;
}
export function createJobMonitor(snapshot: JobSystemSnapshot): JobMonitor {
    return { snapshot, samples: [sampleOf(snapshot)] };
}
export function advanceJobMonitor(monitor: JobMonitor, snapshot: JobSystemSnapshot): JobMonitor {
    if (isQuiet(snapshot) && showsSamePicture(monitor.snapshot, snapshot))
        return monitor;
    return { snapshot, samples: [...monitor.samples.slice(-LOAD_BUCKETS), sampleOf(snapshot)] };
}
export function threadLoad(samples: readonly LoadSample[], thread: number): LoadBucket[] {
    const buckets: LoadBucket[] = [];
    for (let index = 1; index < samples.length; index++) {
        const previous = samples[index - 1];
        const current = samples[index];
        const elapsedMs = current.at - previous.at;
        const busyMs = (current.busyMs[thread] ?? 0) - (previous.busyMs[thread] ?? 0);
        buckets.push({ at: current.at, load: elapsedMs > 0 ? Math.min(1, Math.max(0, busyMs / elapsedMs)) : 0 });
    }
    return buckets;
}
export function averageLoad(buckets: readonly LoadBucket[]): number {
    if (buckets.length === 0)
        return 0;
    return buckets.reduce((total, bucket) => total + bucket.load, 0) / buckets.length;
}
