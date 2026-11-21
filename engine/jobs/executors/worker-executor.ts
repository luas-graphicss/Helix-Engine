import type { JobResponse } from '../protocol/job-messages';
import { serializeJobError } from '../worker/job-runner';
import { toJobRequest, type JobDispatch, type JobExecutor } from './job-executor';
interface PendingRun {
    resolve(response: JobResponse): void;
    reject(error: Error): void;
}
const CRASH_MESSAGE = 'A thread de jobs parou de responder.';
const UNREADABLE_MESSAGE = 'A thread de jobs devolveu um resultado ilegível.';
export class WorkerExecutor implements JobExecutor {
    readonly kind = 'worker';
    private readonly knownPrograms = new Set<number>();
    private pending: PendingRun | null = null;
    private crash: Error | null = null;
    constructor(private readonly worker: Worker) {
        worker.onmessage = (event: MessageEvent<JobResponse>) => this.takePending()?.resolve(event.data);
        worker.onerror = (event) => this.fail(new Error(event.message || CRASH_MESSAGE));
        worker.onmessageerror = () => this.fail(new Error(UNREADABLE_MESSAGE));
    }
    run(dispatch: JobDispatch): Promise<JobResponse> {
        if (this.crash)
            return Promise.reject(this.crash);
        return new Promise((resolve, reject) => {
            this.pending = { resolve, reject };
            try {
                this.worker.postMessage(toJobRequest(dispatch, this.knownPrograms), [...dispatch.transfer]);
                this.knownPrograms.add(dispatch.program.id);
            }
            catch (cause) {
                this.pending = null;
                resolve({ jobId: dispatch.jobId, ok: false, error: serializeJobError(cause) });
            }
        });
    }
    terminate(): void {
        this.pending = null;
        this.worker.terminate();
    }
    private fail(error: Error): void {
        this.crash = error;
        this.takePending()?.reject(error);
    }
    private takePending(): PendingRun | null {
        const pending = this.pending;
        this.pending = null;
        return pending;
    }
}
