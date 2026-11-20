export class TokenBucket {
    private tokens: number;
    private lastAt: number | null = null;
    constructor(private readonly perSecond: number, private readonly burst = perSecond) {
        this.tokens = burst;
    }
    tryTake(nowMs: number): boolean {
        if (this.lastAt !== null)
            this.tokens = Math.min(this.burst, this.tokens + (Math.max(0, nowMs - this.lastAt) / 1000) * this.perSecond);
        this.lastAt = nowMs;
        if (this.tokens < 1)
            return false;
        this.tokens -= 1;
        return true;
    }
}
