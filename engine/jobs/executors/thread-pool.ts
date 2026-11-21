import type { ExecutorFactory, JobExecutor } from './job-executor';
export interface ThreadSlot {
    readonly index: number;
    executor: JobExecutor;
    builtBy: ExecutorFactory;
    stale: boolean;
    busy: boolean;
    completed: number;
    busyMs: number;
}
export class ThreadPool {
    private readonly slots: ThreadSlot[] = [];
    constructor(private factory: ExecutorFactory, private capacity: number) { }
    get size(): number {
        return this.capacity;
    }
    slotAt(index: number): ThreadSlot | undefined {
        return this.slots[index];
    }
    acquire(): ThreadSlot | null {
        const slot = this.slots.find((candidate) => !candidate.busy && candidate.index < this.capacity) ?? this.grow();
        if (!slot)
            return null;
        if (slot.stale || slot.builtBy !== this.factory)
            this.rebuild(slot);
        slot.busy = true;
        return slot;
    }
    release(slot: ThreadSlot): void {
        slot.busy = false;
        this.trim();
    }
    discard(slot: ThreadSlot): void {
        if (slot.stale)
            return;
        slot.executor.terminate();
        slot.stale = true;
    }
    resize(capacity: number): void {
        this.capacity = capacity;
        this.trim();
    }
    useFactory(factory: ExecutorFactory): void {
        this.factory = factory;
        this.terminateIdle();
    }
    terminateIdle(): void {
        for (const slot of this.slots)
            if (!slot.busy)
                this.discard(slot);
    }
    dispose(): void {
        for (const slot of this.slots.splice(0))
            this.discard(slot);
    }
    private grow(): ThreadSlot | null {
        if (this.slots.length >= this.capacity)
            return null;
        const index = this.slots.length;
        const slot: ThreadSlot = { index, executor: this.factory(index), builtBy: this.factory, stale: false, busy: false, completed: 0, busyMs: 0 };
        this.slots.push(slot);
        return slot;
    }
    private rebuild(slot: ThreadSlot): void {
        const executor = this.factory(slot.index);
        this.discard(slot);
        slot.executor = executor;
        slot.builtBy = this.factory;
        slot.stale = false;
    }
    private trim(): void {
        while (this.slots.length > this.capacity && !this.slots[this.slots.length - 1].busy) {
            const slot = this.slots.pop();
            if (slot)
                this.discard(slot);
        }
    }
}
