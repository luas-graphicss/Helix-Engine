export type FlushScheduler = (flush: () => void) => void;
const scheduleMicrotask: FlushScheduler = (flush) => queueMicrotask(flush);
export class EventQueue<TName extends string> {
    private readonly pending = new Set<TName>();
    private scheduled = false;
    private delivering = false;
    constructor(private readonly deliver: (name: TName) => void, private readonly schedule: FlushScheduler = scheduleMicrotask) { }
    push(name: TName): void {
        if (this.delivering)
            return;
        this.pending.add(name);
        if (this.scheduled)
            return;
        this.scheduled = true;
        this.schedule(() => this.flush());
    }
    clear(): void {
        this.pending.clear();
    }
    private flush(): void {
        this.scheduled = false;
        const names = Array.from(this.pending);
        this.pending.clear();
        this.delivering = true;
        try {
            for (const name of names)
                this.deliver(name);
        }
        finally {
            this.delivering = false;
        }
    }
}
