const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_RATIO = 0.3;
export class ReconnectBackoff {
    private attempt = 0;
    reset(): void {
        this.attempt = 0;
    }
    nextDelayMs(): number {
        const ceiling = Math.min(MAX_DELAY_MS, INITIAL_DELAY_MS * 2 ** this.attempt);
        this.attempt++;
        return Math.round(ceiling * (1 - JITTER_RATIO * Math.random()));
    }
}
