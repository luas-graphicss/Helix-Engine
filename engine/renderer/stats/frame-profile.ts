export const CPU_LANES = ['scripts', 'physics', 'sync', 'render', 'ui'] as const;
export type CpuLane = (typeof CPU_LANES)[number];
export const CPU_LANE_LABELS: Record<CpuLane, string> = {
    scripts: 'Scripts (onUpdate, onFixedUpdate, onLateUpdate)',
    physics: 'Física (passos fixos e sincronização das poses)',
    sync: 'Sistemas (CSG, personagens, animação, som, interface, efeitos)',
    render: 'Render (CPU: culling, lotes e submissão)',
    ui: 'Fora do loop (React, navegador, espera da GPU)',
};
export const CPU_LANE_SHORT: Record<CpuLane, string> = {
    scripts: 'scripts',
    physics: 'física',
    sync: 'sistemas',
    render: 'render',
    ui: 'fora',
};
const HISTORY = 600;
const SMOOTHING = 0.15;
export type FrameProfileListener = (profile: FrameProfile) => void;
export class FrameProfile {
    readonly laneMs = new Float32Array(CPU_LANES.length);
    readonly laneAverageMs = new Float32Array(CPU_LANES.length);
    frameIntervalMs = 0;
    frameIntervalAverageMs = 0;
    qualityLevel = 0;
    qualityLevelAverage = 0;
    frames = 0;
    private readonly intervals = new Float32Array(HISTORY);
    private readonly sorted = new Float32Array(HISTORY);
    private count = 0;
    private cursor = 0;
    private sortedDirty = true;
    private readonly openLanes: number[] = [];
    private readonly openStarted: number[] = [];
    private readonly openNested: number[] = [];
    private readonly frameLaneMs = new Float32Array(CPU_LANES.length);
    private readonly listeners = new Set<FrameProfileListener>();
    begin(lane: CpuLane): void {
        this.openLanes.push(CPU_LANES.indexOf(lane));
        this.openStarted.push(performance.now());
        this.openNested.push(0);
    }
    end(lane: CpuLane): void {
        const index = this.openLanes.pop();
        const started = this.openStarted.pop();
        const nested = this.openNested.pop();
        if (index === undefined || started === undefined || nested === undefined)
            return;
        if (CPU_LANES[index] !== lane)
            return;
        const elapsed = performance.now() - started;
        this.frameLaneMs[index] += Math.max(0, elapsed - nested);
        const depth = this.openNested.length;
        if (depth > 0)
            this.openNested[depth - 1] += elapsed;
    }
    add(lane: CpuLane, ms: number): void {
        if (!(ms > 0))
            return;
        this.frameLaneMs[CPU_LANES.indexOf(lane)] += ms;
    }
    get measuredMs(): number {
        let sum = 0;
        for (let i = 0; i < CPU_LANES.length - 1; i++)
            sum += this.frameLaneMs[i];
        return sum;
    }
    endFrame(intervalMs: number, qualityLevel: number): void {
        const lanes = this.frameLaneMs;
        const measured = this.measuredMs;
        lanes[CPU_LANES.length - 1] = intervalMs > 0 ? Math.max(0, intervalMs - measured) : 0;
        for (let i = 0; i < lanes.length; i++) {
            this.laneMs[i] = lanes[i];
            this.laneAverageMs[i] = this.frames === 0 ? lanes[i] : this.laneAverageMs[i] + (lanes[i] - this.laneAverageMs[i]) * SMOOTHING;
            lanes[i] = 0;
        }
        this.qualityLevel = qualityLevel;
        this.qualityLevelAverage = this.frames === 0 ? qualityLevel : this.qualityLevelAverage + (qualityLevel - this.qualityLevelAverage) * SMOOTHING;
        this.frameIntervalMs = intervalMs;
        if (intervalMs > 0) {
            this.frameIntervalAverageMs = this.frameIntervalAverageMs === 0 ? intervalMs : this.frameIntervalAverageMs + (intervalMs - this.frameIntervalAverageMs) * SMOOTHING;
            this.intervals[this.cursor] = intervalMs;
            this.cursor = (this.cursor + 1) % HISTORY;
            if (this.count < HISTORY)
                this.count++;
            this.sortedDirty = true;
        }
        this.frames++;
        for (const listener of this.listeners)
            listener(this);
    }
    percentile(p: number): number {
        if (this.count === 0)
            return 0;
        if (this.sortedDirty) {
            this.sorted.set(this.intervals.subarray(0, this.count));
            this.sorted.subarray(0, this.count).sort();
            this.sortedDirty = false;
        }
        const index = Math.min(this.count - 1, Math.max(0, Math.round(p * (this.count - 1))));
        return this.sorted[index];
    }
    get fps(): number {
        return this.frameIntervalAverageMs > 0 ? 1000 / this.frameIntervalAverageMs : 0;
    }
    get sampleCount(): number {
        return this.count;
    }
    onFrame(listener: FrameProfileListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    reset(): void {
        this.count = 0;
        this.cursor = 0;
        this.sortedDirty = true;
        this.frames = 0;
        this.frameIntervalMs = 0;
        this.frameIntervalAverageMs = 0;
        this.qualityLevel = 0;
        this.qualityLevelAverage = 0;
        this.laneMs.fill(0);
        this.laneAverageMs.fill(0);
    }
}
