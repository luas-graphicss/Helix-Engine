import type { JobToolkit } from '../program/job-toolkit';
import type { JobResponse } from '../protocol/job-messages';
import { JobRunner, serializeJobError } from '../worker/job-runner';
import { toJobRequest, type JobDispatch, type JobExecutor } from './job-executor';
function nextMacrotask(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
export class InlineExecutor implements JobExecutor {
    readonly kind = 'inline';
    private readonly knownPrograms = new Set<number>();
    private readonly runner: JobRunner;
    constructor(toolkit: JobToolkit) {
        this.runner = new JobRunner(toolkit);
    }
    async run(dispatch: JobDispatch): Promise<JobResponse> {
        await nextMacrotask();
        try {
            const request = structuredClone(toJobRequest(dispatch, this.knownPrograms), { transfer: [...dispatch.transfer] });
            this.knownPrograms.add(dispatch.program.id);
            const { response, transfer } = await this.runner.run(request);
            return structuredClone(response, { transfer });
        }
        catch (cause) {
            return { jobId: dispatch.jobId, ok: false, error: serializeJobError(cause) };
        }
    }
    terminate(): void {
        this.knownPrograms.clear();
    }
}
