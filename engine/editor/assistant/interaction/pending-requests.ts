export class PendingRequests<TAnswer> {
    private readonly settlers = new Map<number, (answer: TAnswer) => void>();
    constructor(private readonly cancelled: TAnswer) { }
    wait(entryId: number, signal: AbortSignal): Promise<TAnswer> {
        return new Promise((resolve) => {
            if (signal.aborted)
                resolve(this.cancelled);
            else
                this.settlers.set(entryId, resolve);
        });
    }
    settle(entryId: number, answer: TAnswer): void {
        const settle = this.settlers.get(entryId);
        if (!settle)
            return;
        this.settlers.delete(entryId);
        settle(answer);
    }
    cancelAll(): void {
        for (const entryId of Array.from(this.settlers.keys()))
            this.settle(entryId, this.cancelled);
    }
}
