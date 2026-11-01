import { HelixArgumentError, isTaskCancelled, TaskCancelledError } from './script-errors';
import type { CallbackInvoker, ScriptOwner, Unsubscribe } from './runtime-context';
export interface TimerHandle {
    readonly id: number;
    cancel(): void;
    readonly cancelled: boolean;
}
interface Timer {
    readonly id: number;
    readonly owner: ScriptOwner | null;
    due: number;
    readonly interval: number | null;
    frames: number;
    readonly label: string;
    readonly run: () => void;
    cancelled: boolean;
}
export interface TaskHandle {
    readonly id: number;
    readonly done: Promise<void>;
    cancel(): void;
    readonly cancelled: boolean;
    readonly finished: boolean;
}
interface Task {
    readonly id: number;
    readonly owner: ScriptOwner | null;
    cancelled: boolean;
    finished: boolean;
    readonly waits: Set<(cause: Error) => void>;
}
export class Scheduler {
    private readonly timers: Timer[] = [];
    private readonly tasks = new Map<number, Task>();
    private nextId = 1;
    private now = 0;
    private frame = 0;
    private currentTask: Task | null = null;
    constructor(private readonly invoker: CallbackInvoker) { }
    get time(): number {
        return this.now;
    }
    get pendingTimers(): number {
        return this.timers.filter((timer) => !timer.cancelled).length;
    }
    get runningTasks(): number {
        return this.tasks.size;
    }
    reset(): void {
        for (const timer of this.timers)
            timer.cancelled = true;
        this.timers.length = 0;
        for (const task of this.tasks.values())
            this.cancelTask(task);
        this.tasks.clear();
        this.now = 0;
        this.frame = 0;
    }
    tick(deltaSeconds: number): void {
        this.now += deltaSeconds;
        this.frame++;
        if (this.timers.length === 0)
            return;
        const due = this.timers.filter((timer) => !timer.cancelled && (timer.frames > 0 ? --timer.frames === 0 : timer.due <= this.now));
        for (const timer of due) {
            if (timer.cancelled)
                continue;
            if (timer.owner && !timer.owner.active) {
                if (timer.interval === null)
                    timer.cancelled = true;
                continue;
            }
            if (timer.interval === null)
                timer.cancelled = true;
            else
                timer.due += timer.interval;
            this.invoker.invoke(timer.owner, timer.label, timer.run);
        }
        if (due.length > 0)
            this.compact();
    }
    private compact(): void {
        let write = 0;
        for (let read = 0; read < this.timers.length; read++) {
            const timer = this.timers[read];
            if (!timer.cancelled)
                this.timers[write++] = timer;
        }
        this.timers.length = write;
    }
    private schedule(owner: ScriptOwner | null, label: string, run: () => void, options: {
        seconds?: number;
        interval?: number | null;
        frames?: number;
    }): TimerHandle {
        if (typeof run !== 'function')
            throw new HelixArgumentError(label, 'o callback precisa ser uma função.');
        const timer: Timer = {
            id: this.nextId++,
            owner,
            due: this.now + Math.max(0, options.seconds ?? 0),
            interval: options.interval ?? null,
            frames: options.frames ?? 0,
            label,
            run,
            cancelled: false,
        };
        this.timers.push(timer);
        const handle: TimerHandle = {
            id: timer.id,
            cancel: () => {
                timer.cancelled = true;
            },
            get cancelled() {
                return timer.cancelled;
            },
        };
        owner?.track(handle.cancel);
        return handle;
    }
    delay(owner: ScriptOwner | null, seconds: number, run: () => void): TimerHandle {
        if (!Number.isFinite(seconds) || seconds < 0)
            throw new HelixArgumentError('helix.time.delay', `segundos inválidos: ${seconds}.`);
        return this.schedule(owner, 'helix.time.delay', run, { seconds });
    }
    every(owner: ScriptOwner | null, seconds: number, run: () => void): TimerHandle {
        if (!Number.isFinite(seconds) || seconds <= 0)
            throw new HelixArgumentError('helix.time.every', `o intervalo precisa ser maior que zero (recebido ${seconds}).`);
        return this.schedule(owner, 'helix.time.every', run, { seconds, interval: seconds });
    }
    nextFrame(owner: ScriptOwner | null, run: () => void): TimerHandle {
        return this.schedule(owner, 'helix.time.nextFrame', run, { frames: 1 });
    }
    afterFrames(owner: ScriptOwner | null, frames: number, run: () => void): TimerHandle {
        return this.schedule(owner, 'helix.time.waitFrames', run, { frames: Math.max(1, Math.floor(frames)) });
    }
    wait(owner: ScriptOwner | null, seconds: number): Promise<void> {
        if (!Number.isFinite(seconds) || seconds < 0)
            throw new HelixArgumentError('helix.time.wait', `segundos inválidos: ${seconds}.`);
        return this.promise(owner, (resolve) => this.schedule(owner, 'helix.time.wait', resolve, { seconds }));
    }
    waitFrames(owner: ScriptOwner | null, frames: number): Promise<void> {
        return this.promise(owner, (resolve) => this.schedule(owner, 'helix.time.waitFrames', resolve, { frames: Math.max(1, Math.floor(frames)) }));
    }
    private promise(owner: ScriptOwner | null, start: (resolve: () => void) => TimerHandle): Promise<void> {
        const task = this.currentTask;
        return new Promise<void>((resolve, reject) => {
            if (task?.cancelled) {
                reject(new TaskCancelledError());
                return;
            }
            const handle = start(() => {
                task?.waits.delete(fail);
                resolve();
            });
            const fail = (cause: Error) => {
                handle.cancel();
                reject(cause);
            };
            task?.waits.add(fail);
            owner?.track(() => fail(new TaskCancelledError()));
        });
    }
    spawn(owner: ScriptOwner | null, fn: () => unknown): TaskHandle {
        if (typeof fn !== 'function')
            throw new HelixArgumentError('helix.task.spawn', 'a tarefa precisa ser uma função.');
        const task: Task = { id: this.nextId++, owner, cancelled: false, finished: false, waits: new Set() };
        this.tasks.set(task.id, task);
        const previous = this.currentTask;
        this.currentTask = task;
        let result: unknown;
        try {
            result = this.invoker.invoke(owner, 'helix.task.spawn', fn);
        }
        finally {
            this.currentTask = previous;
        }
        const done = Promise.resolve(result)
            .then(() => undefined, (cause: unknown) => {
            if (!isTaskCancelled(cause))
                this.invoker.invoke(owner, 'tarefa assíncrona', () => {
                    throw cause;
                });
        })
            .finally(() => {
            task.finished = true;
            this.tasks.delete(task.id);
        });
        const handle: TaskHandle = {
            id: task.id,
            done,
            cancel: () => this.cancelTask(task),
            get cancelled() {
                return task.cancelled;
            },
            get finished() {
                return task.finished;
            },
        };
        owner?.track(handle.cancel);
        return handle;
    }
    runInTask<T>(owner: ScriptOwner | null, fn: () => T): T {
        const previous = this.currentTask;
        const task: Task = { id: this.nextId++, owner, cancelled: false, finished: false, waits: new Set() };
        this.currentTask = task;
        try {
            return fn();
        }
        finally {
            this.currentTask = previous;
        }
    }
    private cancelTask(task: Task): void {
        if (task.cancelled)
            return;
        task.cancelled = true;
        for (const fail of Array.from(task.waits))
            fail(new TaskCancelledError());
        task.waits.clear();
    }
    managedGlobals(resolveOwner: () => ScriptOwner | null): Record<string, (...args: never[]) => unknown> {
        const handles = new Map<number, TimerHandle>();
        const remember = (handle: TimerHandle) => {
            handles.set(handle.id, handle);
            return handle.id;
        };
        const forget = (id: unknown) => {
            if (typeof id !== 'number')
                return;
            handles.get(id)?.cancel();
            handles.delete(id);
        };
        return {
            setTimeout: (fn: () => void, ms = 0) => remember(this.schedule(resolveOwner(), 'setTimeout', fn, { seconds: Math.max(0, Number(ms) || 0) / 1000 })),
            clearTimeout: forget,
            setInterval: (fn: () => void, ms = 0) => {
                const seconds = Math.max(1 / 240, (Number(ms) || 0) / 1000);
                return remember(this.schedule(resolveOwner(), 'setInterval', fn, { seconds, interval: seconds }));
            },
            clearInterval: forget,
            requestAnimationFrame: (fn: (time: number) => void) => remember(this.schedule(resolveOwner(), 'requestAnimationFrame', () => fn(this.now * 1000), { frames: 1 })),
            cancelAnimationFrame: forget,
            queueMicrotask: (fn: () => void) => {
                if (typeof fn !== 'function')
                    throw new HelixArgumentError('queueMicrotask', 'o callback precisa ser uma função.');
                const owner = resolveOwner();
                queueMicrotask(() => this.invoker.invoke(owner, 'queueMicrotask', fn));
            },
        };
    }
    dropOwner(owner: ScriptOwner): Unsubscribe {
        return () => {
            for (const timer of this.timers)
                if (timer.owner === owner)
                    timer.cancelled = true;
            for (const task of this.tasks.values())
                if (task.owner === owner)
                    this.cancelTask(task);
        };
    }
}
