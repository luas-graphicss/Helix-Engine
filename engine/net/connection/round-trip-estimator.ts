const MIN_RETRANSMIT_MS = 60;
const MAX_RETRANSMIT_MS = 2000;
const INITIAL_RETRANSMIT_MS = 250;
const SMOOTHING = 0.125;
const VARIANCE_SMOOTHING = 0.25;
export class RoundTripEstimator {
    private smoothedMs = 0;
    private varianceMs = 0;
    private samples = 0;
    get roundTripMs(): number {
        return this.smoothedMs;
    }
    get jitterMs(): number {
        return this.varianceMs;
    }
    get retransmitMs(): number {
        if (this.samples === 0)
            return INITIAL_RETRANSMIT_MS;
        return Math.min(MAX_RETRANSMIT_MS, Math.max(MIN_RETRANSMIT_MS, this.smoothedMs + 4 * this.varianceMs));
    }
    sample(roundTripMs: number): void {
        this.samples++;
        if (this.samples === 1) {
            this.smoothedMs = roundTripMs;
            this.varianceMs = roundTripMs / 2;
            return;
        }
        this.varianceMs += VARIANCE_SMOOTHING * (Math.abs(this.smoothedMs - roundTripMs) - this.varianceMs);
        this.smoothedMs += SMOOTHING * (roundTripMs - this.smoothedMs);
    }
}
