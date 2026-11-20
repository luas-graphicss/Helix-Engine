import { createJobToolkit } from '../program/job-toolkit';
import type { JobRequest, JobResponse } from '../protocol/job-messages';
import { JobRunner, serializeJobError } from './job-runner';
const scope = self as unknown as DedicatedWorkerGlobalScope;
const runner = new JobRunner(createJobToolkit());
async function respond(request: JobRequest): Promise<void> {
    const { response, transfer } = await runner.run(request);
    try {
        scope.postMessage(response, transfer);
    }
    catch (cause) {
        const failure: JobResponse = { jobId: request.jobId, ok: false, error: serializeJobError(cause) };
        scope.postMessage(failure);
    }
}
scope.onmessage = (event: MessageEvent<JobRequest>) => {
    void respond(event.data);
};
