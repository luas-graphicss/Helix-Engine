import type { JobProgram } from '../program/job-program';
import type { JobRange, JobRequest, JobResponse, OutputBinding } from '../protocol/job-messages';
export interface JobDispatch {
    readonly jobId: number;
    readonly thread: number;
    readonly program: JobProgram;
    readonly input: unknown;
    readonly transfer: readonly Transferable[];
    readonly range: JobRange;
    readonly output: OutputBinding | null;
}
export type ExecutorKind = 'worker' | 'inline';
export interface JobExecutor {
    readonly kind: ExecutorKind;
    run(dispatch: JobDispatch): Promise<JobResponse>;
    terminate(): void;
}
export type ExecutorFactory = (thread: number) => JobExecutor;
export function toJobRequest(dispatch: JobDispatch, knownPrograms: ReadonlySet<number>): JobRequest {
    const { program } = dispatch;
    return {
        jobId: dispatch.jobId,
        thread: dispatch.thread,
        programId: program.id,
        source: knownPrograms.has(program.id) ? null : program.source,
        input: dispatch.input,
        range: dispatch.range,
        output: dispatch.output,
    };
}
