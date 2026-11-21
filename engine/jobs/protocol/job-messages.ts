import type { JobArray, JobBufferKind } from '../memory/job-buffer';
export interface JobRange {
    readonly index: number;
    readonly start: number;
    readonly end: number;
}
export type OutputBinding = {
    readonly mode: 'shared';
    readonly kind: JobBufferKind;
    readonly buffer: SharedArrayBuffer;
    readonly byteOffset: number;
    readonly length: number;
} | {
    readonly mode: 'copy';
    readonly kind: JobBufferKind;
    readonly length: number;
};
export interface JobRequest {
    readonly jobId: number;
    readonly thread: number;
    readonly programId: number;
    readonly source: string | null;
    readonly input: unknown;
    readonly range: JobRange;
    readonly output: OutputBinding | null;
}
export interface SerializedJobError {
    readonly name: string;
    readonly message: string;
    readonly stack: string;
}
export type JobResponse = {
    readonly jobId: number;
    readonly ok: true;
    readonly value: unknown;
    readonly output: JobArray | null;
} | {
    readonly jobId: number;
    readonly ok: false;
    readonly error: SerializedJobError;
};
