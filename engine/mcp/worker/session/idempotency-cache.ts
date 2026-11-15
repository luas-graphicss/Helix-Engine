interface CachedEntry<TValue> {
    readonly expiresAt: number;
    readonly value: Promise<TValue>;
}
export class IdempotencyCache<TValue> {
    private readonly entries = new Map<string, CachedEntry<TValue>>();
    constructor(private readonly ttlMs: number, private readonly capacity: number, private readonly shouldKeep: (value: TValue) => boolean) { }
    run(key: string | null, task: () => Promise<TValue>): Promise<TValue> {
        if (key === null)
            return task();
        this.prune();
        const cached = this.entries.get(key);
        if (cached)
            return cached.value;
        const value = task().then((settled) => {
            if (!this.shouldKeep(settled))
                this.entries.delete(key);
            return settled;
        });
        this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, value });
        return value;
    }
    private prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now || this.entries.size > this.capacity)
                this.entries.delete(key);
        }
    }
}
