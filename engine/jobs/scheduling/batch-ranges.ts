import type { JobRange } from '../protocol/job-messages';
export const MAX_BATCHES = 1024;
const BATCHES_PER_THREAD = 4;
export function resolveBatchSize(count: number, requested: number | undefined, threads: number): number {
    const balanced = Math.ceil(count / (threads * BATCHES_PER_THREAD));
    return Math.max(1, requested ?? balanced, Math.ceil(count / MAX_BATCHES));
}
export function splitIntoBatches(count: number, batchSize: number): JobRange[] {
    const ranges: JobRange[] = [];
    for (let start = 0; start < count; start += batchSize)
        ranges.push({ index: ranges.length, start, end: Math.min(count, start + batchSize) });
    return ranges;
}
