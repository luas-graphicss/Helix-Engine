import { MAX_RENDER_SCALE, MIN_RENDER_SCALE } from './dynamic-resolution';
export interface QualityStep {
    readonly renderScale: number;
    readonly cascadePeriodScale: number;
    readonly staticCascadesPerFrame: number;
    readonly localShadowFacesScale: number;
    readonly cloudStepsScale: number;
    readonly cloudScale: number;
    readonly terrainBurstScale: number;
    readonly maxShadowedLights: number;
    readonly grassDensityScale: number;
    readonly grassBuildScale: number;
    readonly bloomLevelsDrop: number;
    readonly postLite: boolean;
    readonly skipAntialias: boolean;
}
export const QUALITY_LADDER: readonly QualityStep[] = [
    {
        renderScale: MAX_RENDER_SCALE,
        cascadePeriodScale: 1,
        staticCascadesPerFrame: 2,
        localShadowFacesScale: 1,
        cloudStepsScale: 1,
        cloudScale: 1,
        terrainBurstScale: 1,
        maxShadowedLights: Number.POSITIVE_INFINITY,
        grassDensityScale: 1,
        grassBuildScale: 1,
        bloomLevelsDrop: 0,
        postLite: false,
        skipAntialias: false,
    },
    {
        renderScale: 0.9,
        cascadePeriodScale: 1,
        staticCascadesPerFrame: 1,
        localShadowFacesScale: 1,
        cloudStepsScale: 1,
        cloudScale: 1,
        terrainBurstScale: 0.5,
        maxShadowedLights: Number.POSITIVE_INFINITY,
        grassDensityScale: 1,
        grassBuildScale: 1,
        bloomLevelsDrop: 0,
        postLite: false,
        skipAntialias: false,
    },
    {
        renderScale: 0.8,
        cascadePeriodScale: 2,
        staticCascadesPerFrame: 1,
        localShadowFacesScale: 0.5,
        cloudStepsScale: 0.75,
        cloudScale: 0.75,
        terrainBurstScale: 0.5,
        maxShadowedLights: Number.POSITIVE_INFINITY,
        grassDensityScale: 1,
        grassBuildScale: 0.5,
        bloomLevelsDrop: 1,
        postLite: false,
        skipAntialias: false,
    },
    {
        renderScale: 0.7,
        cascadePeriodScale: 2,
        staticCascadesPerFrame: 1,
        localShadowFacesScale: 0.5,
        cloudStepsScale: 0.5,
        cloudScale: 0.5,
        terrainBurstScale: 0.25,
        maxShadowedLights: 2,
        grassDensityScale: 0.7,
        grassBuildScale: 0.5,
        bloomLevelsDrop: 2,
        postLite: true,
        skipAntialias: false,
    },
    {
        renderScale: MIN_RENDER_SCALE,
        cascadePeriodScale: 4,
        staticCascadesPerFrame: 1,
        localShadowFacesScale: 0.25,
        cloudStepsScale: 0.25,
        cloudScale: 0.5,
        terrainBurstScale: 0.25,
        maxShadowedLights: 0,
        grassDensityScale: 0.5,
        grassBuildScale: 0.25,
        bloomLevelsDrop: 2,
        postLite: true,
        skipAntialias: true,
    },
];
export const FULL_QUALITY: QualityStep = QUALITY_LADDER[0];
export const EDITOR_QUALITY_LADDER: readonly QualityStep[] = QUALITY_LADDER.map((step) => ({
    ...step,
    maxShadowedLights: Number.POSITIVE_INFINITY,
    grassDensityScale: 1,
    bloomLevelsDrop: 0,
    postLite: false,
    skipAntialias: false,
}));
const OVER_BUDGET_RATIO = 1.12;
const OVER_BUDGET_FRAMES = 6;
const SEVERE_OVER_BUDGET_RATIO = 1.6;
const COOLDOWN_FRAMES = 20;
const PROBE_FRAMES = 90;
const MAX_PROBE_FRAMES = 90 * 8;
const PROBE_CONFIRM_FRAMES = 30;
const PROBE_HEADROOM_RATIO = 0.78;
const EMA_ALPHA = 0.2;
export class FrameGovernor {
    level = 0;
    private intervalEma = 0;
    private loadEma = 0;
    private overBudget = 0;
    private stable = 0;
    private cooldown = 0;
    private probeFrames = PROBE_FRAMES;
    private probing = false;
    constructor(private ladder: readonly QualityStep[] = QUALITY_LADDER) { }
    get step(): QualityStep {
        return this.ladder[this.level];
    }
    get maxLevel(): number {
        return this.ladder.length - 1;
    }
    setLadder(ladder: readonly QualityStep[]): void {
        if (ladder === this.ladder)
            return;
        this.ladder = ladder;
        this.level = Math.min(this.level, this.maxLevel);
    }
    get frameIntervalMs(): number {
        return this.intervalEma;
    }
    get loadMs(): number {
        return this.loadEma;
    }
    update(frameIntervalMs: number, budgetMs: number, loadMs = frameIntervalMs): QualityStep {
        this.intervalEma = this.intervalEma === 0 ? frameIntervalMs : this.intervalEma + (frameIntervalMs - this.intervalEma) * EMA_ALPHA;
        this.loadEma = this.loadEma === 0 ? loadMs : this.loadEma + (loadMs - this.loadEma) * EMA_ALPHA;
        if (this.cooldown > 0) {
            this.cooldown--;
            return this.step;
        }
        const measured = loadMs !== frameIntervalMs;
        const signal = measured ? Math.max(this.loadEma, this.intervalEma > budgetMs * SEVERE_OVER_BUDGET_RATIO ? this.intervalEma : 0) : this.intervalEma;
        if (signal > budgetMs * OVER_BUDGET_RATIO) {
            this.overBudget++;
            this.stable = 0;
            if (this.overBudget >= OVER_BUDGET_FRAMES && this.level < this.maxLevel) {
                const steps = signal > budgetMs * SEVERE_OVER_BUDGET_RATIO ? 2 : 1;
                this.level = Math.min(this.maxLevel, this.level + steps);
                if (this.probing)
                    this.probeFrames = Math.min(MAX_PROBE_FRAMES, this.probeFrames * 2);
                this.probing = false;
                this.afterChange();
            }
            return this.step;
        }
        this.overBudget = 0;
        this.stable++;
        if (this.probing && this.stable >= PROBE_CONFIRM_FRAMES) {
            this.probing = false;
            this.probeFrames = PROBE_FRAMES;
        }
        const headroom = !measured || this.loadEma <= budgetMs * PROBE_HEADROOM_RATIO;
        if (this.stable >= this.probeFrames && this.level > 0 && headroom) {
            this.level--;
            this.probing = true;
            this.afterChange();
        }
        return this.step;
    }
    interrupt(): void {
        this.intervalEma = 0;
        this.loadEma = 0;
        this.overBudget = 0;
    }
    reset(): void {
        this.level = 0;
        this.intervalEma = 0;
        this.loadEma = 0;
        this.overBudget = 0;
        this.stable = 0;
        this.cooldown = 0;
        this.probeFrames = PROBE_FRAMES;
        this.probing = false;
    }
    private afterChange(): void {
        this.overBudget = 0;
        this.stable = 0;
        this.cooldown = COOLDOWN_FRAMES;
        this.intervalEma = 0;
        this.loadEma = 0;
    }
}
