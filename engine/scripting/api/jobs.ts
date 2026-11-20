import { JOB_BUFFER_KINDS, isJobArray, type JobArray } from '@/engine/jobs/memory/job-buffer';
import { JobProgramError, describeJobFunction, type JobProgram } from '@/engine/jobs/program/job-program';
import { JOB_PRIORITIES } from '@/engine/jobs/scheduling/job-queue';
import { JobCancelledError } from '@/engine/jobs/system/job-errors';
import type { JobHandle, JobStatus } from '@/engine/jobs/system/job-handle';
import type { ParallelForOptions } from '@/engine/jobs/system/job-system';
import { DEBUG_PARAMETER } from '../compiler/debug-instrument';
import type { RuntimeHost } from '../runtime/runtime-host';
import { HelixArgumentError, TaskCancelledError } from '../runtime/script-errors';
import { requireFunction, requireNumber, requireObject, requireOneOf, requireString } from '../runtime/values';
type ScriptJobFunction = (...args: never[]) => unknown;
type SharedJobOptions = Omit<ParallelForOptions, 'batchSize' | 'stride'>;
interface ScriptJob {
    readonly id: number;
    readonly name: string;
    readonly status: JobStatus;
    readonly done: Promise<unknown>;
    cancel(): void;
    then: Promise<unknown>['then'];
}
const MILLISECONDS_PER_SECOND = 1000;
const DEBUG_SHIM = `const ${DEBUG_PARAMETER}={l:[],h(){},s(){}};`;
function withDebugShim(source: string): string {
    return source.includes(DEBUG_PARAMETER) ? `(() => {${DEBUG_SHIM}return (${source}\n);})()` : source;
}
function settleForScripts(handle: JobHandle<unknown>): Promise<unknown> {
    const done: Promise<unknown> = new Promise((resolve, reject) => {
        handle.done.then(resolve, (error: unknown) => {
            if (!(error instanceof JobCancelledError)) {
                reject(error);
                return;
            }
            done.catch(() => undefined);
            reject(new TaskCancelledError());
        });
    });
    return done;
}
function optional<TValue>(value: unknown, read: (value: unknown) => TValue): TValue | undefined {
    return value === undefined || value === null ? undefined : read(value);
}
export function createJobsApi(host: RuntimeHost) {
    const { jobs } = host;
    const programs = new WeakMap<ScriptJobFunction, JobProgram>();
    const handles = new WeakMap<object, JobHandle<unknown>>();
    function programOf(fn: ScriptJobFunction, member: string): JobProgram {
        const known = programs.get(fn);
        if (known)
            return known;
        try {
            const program = jobs.program(withDebugShim(describeJobFunction(fn)));
            programs.set(fn, program);
            return program;
        }
        catch (cause) {
            if (cause instanceof JobProgramError)
                throw new HelixArgumentError(member, cause.message);
            throw cause;
        }
    }
    function expose(handle: JobHandle<unknown>): ScriptJob {
        const done = settleForScripts(handle);
        const job: ScriptJob = {
            id: handle.id,
            name: handle.name,
            get status() {
                return handle.status;
            },
            done,
            cancel: () => handle.cancel(),
            then: (onFulfilled, onRejected) => done.then(onFulfilled, onRejected),
        };
        handles.set(job, handle);
        return job;
    }
    function handleOf(value: unknown, member: string): JobHandle<unknown> {
        const handle = typeof value === 'object' && value !== null ? handles.get(value) : undefined;
        if (!handle)
            throw new HelixArgumentError(member, 'esperava o handle devolvido por helix.jobs.run ou helix.jobs.parallelFor.');
        return handle;
    }
    function handlesOf(value: unknown, member: string): JobHandle<unknown>[] {
        if (!Array.isArray(value))
            throw new HelixArgumentError(member, 'esperava uma lista de handles de job.');
        return value.map((item) => handleOf(item, member));
    }
    function outputOf(value: unknown, member: string): JobArray {
        if (isJobArray(value))
            return value;
        throw new HelixArgumentError(member, 'options.output precisa ser um typed array numérico, como Float32Array.');
    }
    function timeoutOf(value: unknown, member: string): number {
        const seconds = requireNumber(value, member, 'options.timeout');
        if (seconds < 0)
            throw new HelixArgumentError(member, 'options.timeout é em segundos e não pode ser negativo; use 0 para não ter limite.');
        return seconds * MILLISECONDS_PER_SECOND;
    }
    function transferOf(value: unknown, member: string): ArrayBuffer[] {
        if (!Array.isArray(value))
            throw new HelixArgumentError(member, 'options.transfer precisa ser uma lista de ArrayBuffer ou typed arrays.');
        return value.map((item: unknown) => {
            const buffer = ArrayBuffer.isView(item) ? item.buffer : item;
            if (buffer instanceof ArrayBuffer)
                return buffer;
            throw new HelixArgumentError(member, 'options.transfer só aceita ArrayBuffer ou typed arrays comuns; memória compartilhada não precisa ser transferida.');
        });
    }
    function sharedOptions(options: Record<string, unknown>, fn: ScriptJobFunction, member: string): SharedJobOptions {
        return {
            name: optional(options.name, (name) => requireString(name, member, 'options.name')) ?? (fn.name || undefined),
            label: host.current?.handle.name,
            priority: optional(options.priority, (priority) => requireOneOf(priority, JOB_PRIORITIES, member, 'options.priority')),
            dependsOn: optional(options.dependsOn, (list) => handlesOf(list, member)),
            timeoutMs: optional(options.timeout, (seconds) => timeoutOf(seconds, member)),
            output: optional(options.output, (array) => outputOf(array, member)),
        };
    }
    return {
        get threads() {
            return jobs.threadCount;
        },
        get sharedMemory() {
            return jobs.sharedMemory;
        },
        run: (fn: unknown, input?: unknown, options?: unknown) => {
            const member = 'helix.jobs.run';
            const run = requireFunction<ScriptJobFunction>(fn, member, 'o job');
            const settings = optional(options, (value) => requireObject(value, member)) ?? {};
            const transfer = optional(settings.transfer, (list) => transferOf(list, member));
            return expose(jobs.schedule(programOf(run, member), input, { ...sharedOptions(settings, run, member), transfer }));
        },
        parallelFor: (count: unknown, fn: unknown, input?: unknown, options?: unknown) => {
            const member = 'helix.jobs.parallelFor';
            const total = requireNumber(count, member, 'a contagem');
            const run = requireFunction<ScriptJobFunction>(fn, member, 'o job');
            const settings = optional(options, (value) => requireObject(value, member)) ?? {};
            const batchSize = optional(settings.batchSize, (size) => requireNumber(size, member, 'options.batchSize'));
            const stride = optional(settings.stride, (size) => requireNumber(size, member, 'options.stride'));
            return expose(jobs.parallelFor(total, programOf(run, member), input, { ...sharedOptions(settings, run, member), batchSize, stride }));
        },
        all: (list: unknown) => Promise.all(handlesOf(list, 'helix.jobs.all').map(settleForScripts)),
        cancel: (handle: unknown) => handleOf(handle, 'helix.jobs.cancel').cancel(),
        createBuffer: (kind: unknown, length: unknown) => {
            const member = 'helix.jobs.createBuffer';
            return jobs.createBuffer(requireOneOf(kind, JOB_BUFFER_KINDS, member, 'o tipo'), requireNumber(length, member, 'o tamanho'));
        },
        stats: () => {
            const { threadCount, mode, queued, waiting, running, totals } = jobs.snapshot();
            return { threads: threadCount, mode, queued: queued + waiting, running, ...totals };
        },
    };
}
