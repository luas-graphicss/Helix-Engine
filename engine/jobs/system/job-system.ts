import { InlineExecutor } from '../executors/inline-executor';
import type { ExecutorFactory, JobDispatch, JobExecutor } from '../executors/job-executor';
import { ThreadPool, type ThreadSlot } from '../executors/thread-pool';
import { createJobBuffer, isSharedBuffer, jobArrayKind, type JobArray, type JobBufferKind } from '../memory/job-buffer';
import { compileJobProgram, type JobProgram } from '../program/job-program';
import { createJobToolkit, type JobToolkit } from '../program/job-toolkit';
import type { JobRange, JobResponse, OutputBinding } from '../protocol/job-messages';
import { resolveBatchSize, splitIntoBatches } from '../scheduling/batch-ranges';
import { JobQueue, type JobPriority } from '../scheduling/job-queue';
import { createJobSettings, normalizeJobSettings, resolveThreadCount, resolveTimeoutMs, type JobSettings } from '../settings/job-settings';
import type { ThreadCapabilities } from '../threads/thread-capabilities';
import { serializeJobError } from '../worker/job-runner';
import { JobCancelledError, JobFailedError, JobQueueFullError, JobTimeoutError } from './job-errors';
import { createJobHandle, type JobHandle, type JobHandleControls } from './job-handle';
import { JobHistory, type JobBatchInfo, type JobOutcomeStatus, type JobRecord, type JobTotals } from './job-history';
export interface JobSystemOptions {
    readonly capabilities: ThreadCapabilities;
    readonly spawnThread: ExecutorFactory | null;
    readonly onFallback?: (reason: string) => void;
}
export interface JobOptions {
    readonly name?: string;
    readonly label?: string;
    readonly priority?: JobPriority;
    readonly dependsOn?: readonly JobHandle<unknown>[];
    readonly timeoutMs?: number;
    readonly transfer?: readonly Transferable[];
    readonly output?: JobArray;
}
export interface ParallelForOptions extends Omit<JobOptions, 'transfer'> {
    readonly batchSize?: number;
    readonly stride?: number;
}
export type JobSystemMode = 'threads' | 'inline';
export interface RunningJobSnapshot {
    readonly name: string;
    readonly label: string;
    readonly batch: JobBatchInfo | null;
    readonly startedAt: number;
}
export interface ThreadSnapshot {
    readonly index: number;
    readonly job: RunningJobSnapshot | null;
    readonly completed: number;
    readonly busyMs: number;
}
export interface JobSystemSnapshot {
    readonly now: number;
    readonly mode: JobSystemMode;
    readonly threadCount: number;
    readonly logicalCores: number;
    readonly sharedMemory: boolean;
    readonly threads: readonly ThreadSnapshot[];
    readonly waiting: number;
    readonly queued: number;
    readonly running: number;
    readonly totals: JobTotals;
    readonly history: readonly JobRecord[];
    readonly lastActivityAt: number;
}
type JobPhase = 'waiting' | 'queued' | 'running' | 'settled';
type SettledDependency = Pick<JobHandleControls<unknown>, 'handle' | 'whenSettled'>;
interface OutputTarget {
    readonly array: JobArray;
    readonly offset: number;
    readonly length: number;
}
interface JobBlueprint {
    readonly program: JobProgram;
    readonly input: unknown;
    readonly options: JobOptions;
    readonly range: JobRange;
    readonly batch: JobBatchInfo | null;
    readonly output: OutputTarget | null;
    readonly group: Pick<JobHandleControls<unknown>, 'advance'> | null;
}
interface JobEntry extends Omit<JobBlueprint, 'options'> {
    readonly id: number;
    readonly name: string;
    readonly label: string;
    readonly priority: JobPriority;
    readonly transfer: readonly Transferable[];
    readonly timeoutMs: number;
    readonly queuedAt: number;
    readonly controls: JobHandleControls<unknown>;
    phase: JobPhase;
    slot: ThreadSlot | null;
    startedAt: number | null;
    attempt: number;
    timer: ReturnType<typeof setTimeout> | null;
}
const DEFAULT_JOB_NAME = 'job';
const SINGLE_RANGE: JobRange = { index: 0, start: 0, end: 0 };
const MAX_PROGRAMS = 512;
const STOP_REASON = 'o sistema de jobs foi parado';
const SIBLING_REASON = 'outro lote do mesmo job não terminou';
function describeCause(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function describeOutput(target: OutputTarget): OutputBinding {
    const { array, offset, length } = target;
    const kind = jobArrayKind(array);
    const { buffer } = array;
    if (!isSharedBuffer(buffer))
        return { mode: 'copy', kind, length };
    return { mode: 'shared', kind, buffer, byteOffset: array.byteOffset + offset * array.BYTES_PER_ELEMENT, length };
}
function requirePositiveInteger(value: number, what: string): void {
    if (!Number.isInteger(value) || value < 1)
        throw new RangeError(`parallelFor: ${what} precisa ser um inteiro a partir de 1 (recebeu ${value}).`);
}
export class JobSystem {
    private readonly queue = new JobQueue<JobEntry>();
    private readonly entries = new Set<JobEntry>();
    private readonly running = new Map<ThreadSlot, JobEntry>();
    private readonly handles = new WeakMap<JobHandle<unknown>, SettledDependency>();
    private readonly programs = new Map<string, JobProgram>();
    private readonly history = new JobHistory();
    private readonly pool: ThreadPool;
    private settings: JobSettings = createJobSettings();
    private mode: JobSystemMode;
    private threadsBroken = false;
    private inlineToolkit: JobToolkit | null = null;
    private nextJobId = 1;
    private nextProgramId = 1;
    private lastActivityAt = 0;
    constructor(private readonly options: JobSystemOptions) {
        const factory = this.threadFactory();
        this.mode = factory ? 'threads' : 'inline';
        this.pool = new ThreadPool(factory ?? this.spawnInline, this.capacityFor(this.mode));
    }
    get threadCount(): number {
        return this.pool.size;
    }
    get sharedMemory(): boolean {
        return this.options.capabilities.sharedMemory;
    }
    configure(settings: JobSettings): void {
        this.settings = normalizeJobSettings(settings);
        this.applyMode();
        this.dispatch();
    }
    program(source: string): JobProgram {
        const known = this.programs.get(source);
        if (known)
            return known;
        compileJobProgram(source);
        if (this.programs.size >= MAX_PROGRAMS)
            this.programs.clear();
        const program: JobProgram = { id: this.nextProgramId++, source };
        this.programs.set(source, program);
        return program;
    }
    createBuffer(kind: JobBufferKind, length: number): JobArray {
        return createJobBuffer(kind, length, this.sharedMemory);
    }
    schedule<TOutput>(program: JobProgram, input: unknown, options: JobOptions = {}): JobHandle<TOutput> {
        this.reserve(1);
        const { output } = options;
        const entry = this.createEntry({ program, input, options, range: SINGLE_RANGE, batch: null, output: output ? { array: output, offset: 0, length: output.length } : null, group: null });
        this.admit(entry, options.dependsOn ?? []);
        return entry.controls.handle as JobHandle<TOutput>;
    }
    parallelFor<TOutput>(count: number, program: JobProgram, input: unknown, options: ParallelForOptions = {}): JobHandle<TOutput[]> {
        const { output, stride = 1, batchSize } = options;
        if (!Number.isInteger(count) || count < 0)
            throw new RangeError(`parallelFor: a contagem precisa ser um inteiro não negativo (recebeu ${count}).`);
        requirePositiveInteger(stride, 'stride');
        if (batchSize !== undefined)
            requirePositiveInteger(batchSize, 'batchSize');
        if (output && output.length < count * stride)
            throw new RangeError(`parallelFor: o array de saída tem ${output.length} elementos, mas ${count} itens de ${stride} valor(es) pedem ${count * stride}.`);
        const ranges = splitIntoBatches(count, resolveBatchSize(count, batchSize, this.threadCount));
        this.reserve(ranges.length);
        const name = options.name ?? DEFAULT_JOB_NAME;
        const dependencies = options.dependsOn ?? [];
        const entries: JobEntry[] = [];
        const cancelBatches = (reason?: string): void => {
            for (const entry of entries)
                this.abort(entry, new JobCancelledError(name, reason));
        };
        const group = createJobHandle<TOutput[]>(this.nextJobId++, name, dependencies.length > 0 ? 'waiting' : 'queued', cancelBatches);
        this.handles.set(group.handle, group);
        if (ranges.length === 0) {
            group.complete([]);
            return group.handle;
        }
        const results: TOutput[] = new Array(ranges.length);
        let remaining = ranges.length;
        for (const range of ranges) {
            const slice = output ? { array: output, offset: range.start * stride, length: (range.end - range.start) * stride } : null;
            const entry = this.createEntry({ program, input, options, range, batch: { index: range.index, count: ranges.length }, output: slice, group });
            entries.push(entry);
            void entry.controls.handle.done.then((value) => {
                results[range.index] = value as TOutput;
                remaining -= 1;
                if (remaining === 0)
                    group.complete(results);
            }, (error: Error) => {
                cancelBatches(SIBLING_REASON);
                if (error instanceof JobCancelledError)
                    group.abort(error);
                else
                    group.fail(error);
            });
        }
        for (const entry of entries)
            this.admit(entry, dependencies);
        return group.handle;
    }
    cancelAll(reason = STOP_REASON): void {
        for (const entry of Array.from(this.entries))
            this.abort(entry, new JobCancelledError(entry.name, reason));
    }
    releaseThreads(): void {
        this.pool.terminateIdle();
        this.programs.clear();
    }
    clearHistory(): void {
        this.history.clear();
        this.lastActivityAt = this.now();
    }
    dispose(): void {
        this.cancelAll();
        this.pool.dispose();
        this.programs.clear();
    }
    snapshot(): JobSystemSnapshot {
        let waiting = 0;
        for (const entry of this.entries)
            if (entry.phase === 'waiting')
                waiting += 1;
        const threads: ThreadSnapshot[] = [];
        for (let index = 0; index < this.pool.size; index++)
            threads.push(this.describeThread(index));
        return {
            now: this.now(),
            mode: this.mode,
            threadCount: this.pool.size,
            logicalCores: this.options.capabilities.logicalCores,
            sharedMemory: this.sharedMemory,
            threads,
            waiting,
            queued: this.queue.size,
            running: this.running.size,
            totals: this.history.totals,
            history: this.history.list,
            lastActivityAt: this.lastActivityAt,
        };
    }
    private readonly spawnInline = (): JobExecutor => {
        this.inlineToolkit ??= createJobToolkit();
        return new InlineExecutor(this.inlineToolkit);
    };
    private now(): number {
        return performance.now();
    }
    private threadFactory(): ExecutorFactory | null {
        const { spawnThread, capabilities } = this.options;
        return this.settings.enabled && !this.threadsBroken && capabilities.workers ? spawnThread : null;
    }
    private capacityFor(mode: JobSystemMode): number {
        return mode === 'threads' ? resolveThreadCount(this.settings, this.options.capabilities.logicalCores) : 1;
    }
    private applyMode(): void {
        const factory = this.threadFactory();
        const mode: JobSystemMode = factory ? 'threads' : 'inline';
        if (mode !== this.mode) {
            this.mode = mode;
            this.pool.useFactory(factory ?? this.spawnInline);
        }
        this.pool.resize(this.capacityFor(mode));
    }
    private fallBackToInline(reason: string): void {
        if (this.mode === 'inline')
            return;
        this.threadsBroken = true;
        this.applyMode();
        this.options.onFallback?.(reason);
    }
    private describeThread(index: number): ThreadSnapshot {
        const slot = this.pool.slotAt(index);
        const entry = slot ? this.running.get(slot) : undefined;
        const startedAt = entry?.startedAt ?? null;
        const job = entry && startedAt !== null ? { name: entry.name, label: entry.label, batch: entry.batch, startedAt } : null;
        const inFlightMs = startedAt === null ? 0 : this.now() - startedAt;
        return { index, job, completed: slot?.completed ?? 0, busyMs: (slot?.busyMs ?? 0) + inFlightMs };
    }
    private reserve(count: number): void {
        if (this.entries.size + count > this.settings.maxQueued)
            throw new JobQueueFullError(this.settings.maxQueued);
    }
    private createEntry(blueprint: JobBlueprint): JobEntry {
        const { options, ...shared } = blueprint;
        const id = this.nextJobId++;
        const name = options.name ?? DEFAULT_JOB_NAME;
        const waits = (options.dependsOn?.length ?? 0) > 0;
        const entry: JobEntry = {
            ...shared,
            id,
            name,
            label: options.label ?? '',
            priority: options.priority ?? 'normal',
            transfer: options.transfer ?? [],
            timeoutMs: options.timeoutMs ?? resolveTimeoutMs(this.settings),
            queuedAt: this.now(),
            controls: createJobHandle<unknown>(id, name, waits ? 'waiting' : 'queued', () => this.abort(entry, new JobCancelledError(name))),
            phase: 'waiting',
            slot: null,
            startedAt: null,
            attempt: 0,
            timer: null,
        };
        this.handles.set(entry.controls.handle, entry.controls);
        this.entries.add(entry);
        this.history.scheduled();
        this.lastActivityAt = entry.queuedAt;
        return entry;
    }
    private dependencyOf(handle: JobHandle<unknown>): SettledDependency {
        const dependency = this.handles.get(handle);
        if (!dependency)
            throw new TypeError('dependsOn só aceita handles criados por este sistema de jobs.');
        return dependency;
    }
    private admit(entry: JobEntry, handles: readonly JobHandle<unknown>[]): void {
        const dependencies = handles.map((handle) => this.dependencyOf(handle));
        let remaining = dependencies.length;
        if (remaining === 0) {
            this.enqueue(entry);
            return;
        }
        for (const dependency of dependencies)
            dependency.whenSettled((status) => {
                if (entry.phase !== 'waiting')
                    return;
                if (status !== 'completed') {
                    this.abort(entry, new JobCancelledError(entry.name, `a dependência "${dependency.handle.name}" não terminou`));
                    return;
                }
                remaining -= 1;
                if (remaining === 0)
                    this.enqueue(entry);
            });
    }
    private enqueue(entry: JobEntry): void {
        entry.phase = 'queued';
        entry.controls.advance('queued');
        this.queue.push(entry);
        this.dispatch();
    }
    private dispatch(): void {
        while (this.queue.size > 0) {
            const slot = this.acquireSlot();
            if (!slot)
                return;
            const entry = this.queue.shift();
            if (!entry) {
                this.pool.release(slot);
                return;
            }
            void this.execute(entry, slot);
        }
    }
    private acquireSlot(): ThreadSlot | null {
        try {
            return this.pool.acquire();
        }
        catch (cause) {
            if (this.mode === 'inline')
                throw cause;
            this.fallBackToInline(describeCause(cause));
            return this.pool.acquire();
        }
    }
    private async execute(entry: JobEntry, slot: ThreadSlot): Promise<void> {
        const attempt = ++entry.attempt;
        entry.phase = 'running';
        entry.slot = slot;
        entry.startedAt = this.now();
        entry.controls.advance('running');
        entry.group?.advance('running');
        this.running.set(slot, entry);
        if (entry.timeoutMs > 0)
            entry.timer = setTimeout(() => this.expire(entry), entry.timeoutMs);
        const dispatch: JobDispatch = { jobId: entry.id, thread: slot.index, program: entry.program, input: entry.input, transfer: entry.transfer, range: entry.range, output: entry.output ? describeOutput(entry.output) : null };
        const isCurrent = (): boolean => entry.attempt === attempt && entry.phase === 'running';
        let response: JobResponse;
        try {
            response = await slot.executor.run(dispatch);
        }
        catch (cause) {
            if (isCurrent())
                this.recoverFromCrash(entry, slot, cause);
            return;
        }
        if (isCurrent())
            this.complete(entry, slot, response);
    }
    private complete(entry: JobEntry, slot: ThreadSlot, response: JobResponse): void {
        this.freeSlot(entry, slot);
        slot.completed += 1;
        if (response.ok) {
            if (entry.output && response.output)
                entry.output.array.set(response.output, entry.output.offset);
            this.settle(entry, 'completed', null);
            entry.controls.complete(response.value);
        }
        else {
            this.settle(entry, 'failed', response.error.message);
            entry.controls.fail(new JobFailedError(entry.name, response.error));
        }
        this.dispatch();
    }
    private recoverFromCrash(entry: JobEntry, slot: ThreadSlot, cause: unknown): void {
        const threadNeverWorked = slot.completed === 0 && slot.executor.kind === 'worker';
        this.freeSlot(entry, slot);
        this.pool.discard(slot);
        if (threadNeverWorked)
            this.fallBackToInline(describeCause(cause));
        if (threadNeverWorked && entry.transfer.length === 0) {
            entry.slot = null;
            entry.startedAt = null;
            this.enqueue(entry);
            return;
        }
        const error = serializeJobError(cause);
        this.settle(entry, 'failed', error.message);
        entry.controls.fail(new JobFailedError(entry.name, error));
        this.dispatch();
    }
    private expire(entry: JobEntry): void {
        const { slot } = entry;
        if (entry.phase !== 'running' || !slot)
            return;
        this.freeSlot(entry, slot);
        this.pool.discard(slot);
        this.settle(entry, 'timeout', `passou do tempo limite de ${entry.timeoutMs} ms`);
        entry.controls.fail(new JobTimeoutError(entry.name, entry.timeoutMs));
        this.dispatch();
    }
    private abort(entry: JobEntry, error: JobCancelledError): void {
        if (entry.phase === 'settled')
            return;
        if (entry.phase === 'queued')
            this.queue.remove(entry);
        const { slot } = entry;
        if (entry.phase === 'running' && slot) {
            this.freeSlot(entry, slot);
            this.pool.discard(slot);
        }
        this.settle(entry, 'cancelled', null);
        entry.controls.abort(error);
        this.dispatch();
    }
    private freeSlot(entry: JobEntry, slot: ThreadSlot): void {
        if (entry.timer !== null)
            clearTimeout(entry.timer);
        entry.timer = null;
        this.running.delete(slot);
        const finishedAt = this.now();
        slot.busyMs += finishedAt - (entry.startedAt ?? finishedAt);
        this.pool.release(slot);
    }
    private settle(entry: JobEntry, status: JobOutcomeStatus, error: string | null): void {
        const finishedAt = this.now();
        entry.phase = 'settled';
        this.entries.delete(entry);
        this.lastActivityAt = finishedAt;
        this.history.record({ id: entry.id, name: entry.name, label: entry.label, batch: entry.batch, thread: entry.slot?.index ?? null, status, queuedAt: entry.queuedAt, startedAt: entry.startedAt, finishedAt, error });
    }
}
