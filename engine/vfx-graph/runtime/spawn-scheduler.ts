import type { SpawnBurst, SpawnPlan } from '../compiler/spawn-plan';
function burstFirings(burst: SpawnBurst, from: number, to: number): number {
    if (burst.interval <= 0)
        return burst.time >= from && burst.time < to ? 1 : 0;
    const first = Math.max(0, Math.ceil((from - burst.time) / burst.interval));
    const last = Math.ceil((to - burst.time) / burst.interval) - 1;
    return Math.max(0, last - first + 1);
}
export class SpawnScheduler {
    private time = 0;
    private fraction = 0;
    constructor(private plan: SpawnPlan) { }
    setPlan(plan: SpawnPlan): void {
        this.plan = plan;
    }
    reset(): void {
        this.time = 0;
        this.fraction = 0;
    }
    advance(delta: number): number {
        const { duration, looping } = this.plan;
        if (duration <= 0)
            return 0;
        let remaining = delta;
        let spawned = 0;
        while (remaining > 0) {
            if (this.time >= duration) {
                if (!looping)
                    break;
                this.time = 0;
            }
            const step = Math.min(remaining, duration - this.time);
            spawned += this.emit(this.time, this.time + step);
            this.time += step;
            remaining -= step;
        }
        return spawned;
    }
    private emit(from: number, to: number): number {
        this.fraction += this.plan.rate * (to - from);
        const whole = Math.floor(this.fraction);
        this.fraction -= whole;
        return whole + this.plan.bursts.reduce((total, burst) => total + burst.count * burstFirings(burst, from, to), 0);
    }
}
