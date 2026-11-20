const MAX_CATCH_UP_TICKS = 8;
export class FixedTicker {
    private accumulatedMs = 0;
    private current = 0;
    readonly intervalMs: number;
    constructor(readonly tickRate: number) {
        this.intervalMs = 1000 / tickRate;
    }
    get tick(): number {
        return this.current;
    }
    get timeMs(): number {
        return this.current * this.intervalMs + this.accumulatedMs;
    }
    advance(elapsedMs: number, run: (tick: number) => void): void {
        this.accumulatedMs += Math.max(0, elapsedMs);
        for (let ran = 0; ran < MAX_CATCH_UP_TICKS && this.accumulatedMs >= this.intervalMs; ran++) {
            this.accumulatedMs -= this.intervalMs;
            this.current++;
            run(this.current);
        }
        if (this.accumulatedMs >= this.intervalMs)
            this.accumulatedMs %= this.intervalMs;
    }
}
