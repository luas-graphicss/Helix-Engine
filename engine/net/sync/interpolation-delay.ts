const MAX_DELAY_MS = 500;
const SMOOTHING = 0.05;
export function targetInterpolationDelay(sendIntervalMs: number, jitterMs: number): number {
    return Math.min(MAX_DELAY_MS, Math.max(sendIntervalMs * 1.5, sendIntervalMs * 2 + jitterMs * 2));
}
export class InterpolationDelay {
    private currentMs: number;
    constructor(private readonly sendIntervalMs: number) {
        this.currentMs = targetInterpolationDelay(sendIntervalMs, 0);
    }
    get delayMs(): number {
        return this.currentMs;
    }
    adapt(jitterMs: number): void {
        this.currentMs += (targetInterpolationDelay(this.sendIntervalMs, jitterMs) - this.currentMs) * SMOOTHING;
    }
}
