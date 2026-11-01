const WINDOW = 8;
const OUTLIER_LOW = 0.5;
const OUTLIER_HIGH = 2;
const DRIFT_CORRECTION = 0.05;
const MAX_DEBT_SECONDS = 0.25;
export class FrameClock {
    private readonly history = new Float64Array(WINDOW);
    private readonly sorted = new Float64Array(WINDOW);
    private count = 0;
    private cursor = 0;
    private debt = 0;
    rawDelta = 0;
    delta = 0;
    update(rawDeltaSeconds: number): number {
        this.rawDelta = rawDeltaSeconds;
        this.history[this.cursor] = rawDeltaSeconds;
        this.cursor = (this.cursor + 1) % WINDOW;
        if (this.count < WINDOW)
            this.count++;
        const smoothed = this.robustMean();
        this.debt += rawDeltaSeconds - smoothed;
        if (Math.abs(this.debt) > MAX_DEBT_SECONDS)
            this.debt = 0;
        const correction = Math.max(-smoothed * DRIFT_CORRECTION, Math.min(smoothed * DRIFT_CORRECTION, this.debt));
        this.debt -= correction;
        this.delta = Math.max(0, smoothed + correction);
        return this.delta;
    }
    reset(): void {
        this.count = 0;
        this.cursor = 0;
        this.debt = 0;
    }
    private robustMean(): number {
        const { count } = this;
        if (count === 1)
            return this.history[0];
        const sorted = this.sorted;
        for (let i = 0; i < count; i++)
            sorted[i] = this.history[i];
        sorted.subarray(0, count).sort();
        const median = count % 2 === 1 ? sorted[(count - 1) >> 1] : (sorted[(count >> 1) - 1] + sorted[count >> 1]) * 0.5;
        let sum = 0;
        let used = 0;
        for (let i = 0; i < count; i++) {
            const value = this.history[i];
            if (value < median * OUTLIER_LOW || value > median * OUTLIER_HIGH)
                continue;
            sum += value;
            used++;
        }
        return used > 0 ? sum / used : median;
    }
}
