const SAMPLE_WINDOW = 8;
const SNAP_THRESHOLD_MS = 250;
const SLEW_RATIO = 0.1;
interface ClockSample {
    readonly roundTripMs: number;
    readonly offsetMs: number;
}
export class NetClock {
    private readonly samples: ClockSample[] = [];
    private offsetMs = 0;
    private bestRoundTripMs = 0;
    get isSynced(): boolean {
        return this.samples.length > 0;
    }
    get roundTripMs(): number {
        return this.bestRoundTripMs;
    }
    serverTime(localTimeMs: number): number {
        return localTimeMs + this.offsetMs;
    }
    addSample(clientSentAt: number, serverReceivedAt: number, serverSentAt: number, clientReceivedAt: number): void {
        const roundTripMs = Math.max(0, clientReceivedAt - clientSentAt - (serverSentAt - serverReceivedAt));
        const offsetMs = (serverReceivedAt - clientSentAt + (serverSentAt - clientReceivedAt)) / 2;
        const first = this.samples.length === 0;
        this.samples.push({ roundTripMs, offsetMs });
        if (this.samples.length > SAMPLE_WINDOW)
            this.samples.shift();
        const best = this.samples.reduce((lowest, sample) => (sample.roundTripMs < lowest.roundTripMs ? sample : lowest));
        this.bestRoundTripMs = best.roundTripMs;
        const drift = best.offsetMs - this.offsetMs;
        this.offsetMs = first || Math.abs(drift) > SNAP_THRESHOLD_MS ? best.offsetMs : this.offsetMs + drift * SLEW_RATIO;
    }
    reset(): void {
        this.samples.length = 0;
        this.offsetMs = 0;
        this.bestRoundTripMs = 0;
    }
}
