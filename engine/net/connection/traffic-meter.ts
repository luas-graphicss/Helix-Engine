const WINDOW_MS = 1000;
export class TrafficMeter {
    private windowStart: number | null = null;
    private windowBytes = 0;
    private windowPackets = 0;
    private bytesRate = 0;
    private packetsRate = 0;
    private total = 0;
    get bytesPerSecond(): number {
        return this.bytesRate;
    }
    get packetsPerSecond(): number {
        return this.packetsRate;
    }
    get totalBytes(): number {
        return this.total;
    }
    record(byteCount: number): void {
        this.windowBytes += byteCount;
        this.windowPackets++;
        this.total += byteCount;
    }
    roll(now: number): void {
        if (this.windowStart === null) {
            this.windowStart = now;
            return;
        }
        const elapsed = now - this.windowStart;
        if (elapsed < WINDOW_MS)
            return;
        this.bytesRate = (this.windowBytes * 1000) / elapsed;
        this.packetsRate = (this.windowPackets * 1000) / elapsed;
        this.windowBytes = 0;
        this.windowPackets = 0;
        this.windowStart = now;
    }
}
