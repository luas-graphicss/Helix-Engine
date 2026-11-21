import type { JobExecutor } from '../executors/job-executor';
import { WorkerExecutor } from '../executors/worker-executor';
export function spawnJobThread(thread: number): JobExecutor {
    const worker = new Worker(new URL('./job.worker.ts', import.meta.url), { type: 'module', name: `helix-job-${thread + 1}` });
    return new WorkerExecutor(worker);
}
