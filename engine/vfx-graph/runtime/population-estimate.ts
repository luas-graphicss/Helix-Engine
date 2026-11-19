export class PopulationEstimate {
    private readonly birthTimes: number[] = [];
    private readonly birthCounts: number[] = [];
    record(time: number, count: number): void {
        if (count <= 0)
            return;
        this.birthTimes.push(time);
        this.birthCounts.push(count);
    }
    alive(time: number, lifetime: number, capacity: number): number {
        while (this.birthTimes.length > 0 && time - this.birthTimes[0] > lifetime) {
            this.birthTimes.shift();
            this.birthCounts.shift();
        }
        let total = 0;
        for (const count of this.birthCounts)
            total += count;
        return Math.min(total, capacity);
    }
    reset(): void {
        this.birthTimes.length = 0;
        this.birthCounts.length = 0;
    }
}
