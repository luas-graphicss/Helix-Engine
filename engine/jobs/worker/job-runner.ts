import { createJobBuffer, viewJobBuffer, type JobArray } from '../memory/job-buffer';
import { collectTransferables } from '../memory/transferables';
import { JobProgramError, compileJobProgram, type JobContext, type JobFunction } from '../program/job-program';
import type { JobToolkit } from '../program/job-toolkit';
import type { JobRequest, JobResponse, OutputBinding, SerializedJobError } from '../protocol/job-messages';
export interface JobOutcome {
    readonly response: JobResponse;
    readonly transfer: ArrayBuffer[];
}
const ERROR_HINTS: Record<string, string> = {
    ReferenceError: ' Funções de job não enxergam variáveis de fora: envie os dados em input.',
    DataCloneError: ' Jobs só trocam dados clonáveis: números, textos, arrays, objetos simples e typed arrays.',
};
export function serializeJobError(cause: unknown): SerializedJobError {
    if (!(cause instanceof Error))
        return { name: 'Error', message: String(cause), stack: '' };
    return { name: cause.name, message: `${cause.message}${ERROR_HINTS[cause.name] ?? ''}`, stack: cause.stack ?? '' };
}
function bindOutput(binding: OutputBinding | null): JobArray | null {
    if (!binding)
        return null;
    if (binding.mode === 'shared')
        return viewJobBuffer(binding.kind, binding.buffer, binding.byteOffset, binding.length);
    return createJobBuffer(binding.kind, binding.length, false);
}
function createContext(toolkit: JobToolkit, request: JobRequest, output: JobArray | null): JobContext {
    return {
        ...toolkit,
        ...request.range,
        thread: request.thread,
        get output() {
            if (!output)
                throw new JobProgramError('job.output só existe quando o job é criado com a opção output.');
            return output;
        },
    };
}
export class JobRunner {
    private readonly programs = new Map<number, JobFunction>();
    constructor(private readonly toolkit: JobToolkit) { }
    async run(request: JobRequest): Promise<JobOutcome> {
        try {
            const output = bindOutput(request.output);
            const run = this.programFor(request);
            const value = await run(request.input, createContext(this.toolkit, request, output));
            const copied = request.output?.mode === 'copy' ? output : null;
            return { response: { jobId: request.jobId, ok: true, value, output: copied }, transfer: collectTransferables([value, copied]) };
        }
        catch (cause) {
            return { response: { jobId: request.jobId, ok: false, error: serializeJobError(cause) }, transfer: [] };
        }
    }
    private programFor(request: JobRequest): JobFunction {
        if (request.source !== null)
            this.programs.set(request.programId, compileJobProgram(request.source));
        const program = this.programs.get(request.programId);
        if (!program)
            throw new JobProgramError(`A thread ainda não recebeu o código do programa ${request.programId}.`);
        return program;
    }
}
