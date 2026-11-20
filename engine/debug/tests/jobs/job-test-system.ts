import { InlineExecutor } from '@/engine/jobs/executors/inline-executor';
import type { ExecutorFactory } from '@/engine/jobs/executors/job-executor';
import { createJobToolkit } from '@/engine/jobs/program/job-toolkit';
import { JobSystem } from '@/engine/jobs/system/job-system';
const TURN_MS = 5;
const toolkit = createJobToolkit();
export const NEVER_ENDING = '() => new Promise(() => undefined)';
export const spawnTestThread: ExecutorFactory = () => new InlineExecutor(toolkit);
export function createTestJobSystem(threads: number, spawnThread: ExecutorFactory | null = spawnTestThread, onFallback?: (reason: string) => void): JobSystem {
    return new JobSystem({ capabilities: { workers: true, logicalCores: threads + 1, sharedMemory: true }, spawnThread, onFallback });
}
export async function failureOf(work: PromiseLike<unknown>): Promise<unknown> {
    try {
        await work;
    }
    catch (error) {
        return error;
    }
    return null;
}
export function nextTurn(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, TURN_MS));
}
