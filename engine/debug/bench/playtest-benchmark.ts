import type { EditorSession } from '@/engine/editor/session/editor-session';
import { CPU_LANES, CPU_LANE_SHORT, type CpuLane } from '@/engine/renderer/stats/frame-profile';
import { FRAME_STAGES, type FrameStage } from '@/engine/renderer/stats/frame-stages';
import { PHYSICS_BACKEND_LABELS } from '@/engine/physics/world/physics-world';
export type BenchmarkState = 'idle' | 'running' | 'done' | 'failed';
export interface StageMean {
    readonly stage: FrameStage;
    readonly ms: number;
}
export interface BenchmarkReport {
    readonly finishedAt: number;
    readonly durationSeconds: number;
    readonly frames: number;
    readonly fps: number;
    readonly frameMs: {
        readonly mean: number;
        readonly p50: number;
        readonly p95: number;
        readonly p99: number;
        readonly max: number;
    };
    readonly qualityLevel: {
        readonly mean: number;
        readonly max: number;
    };
    readonly renderScaleMean: number;
    readonly cpuLanesMs: Readonly<Record<CpuLane, number>>;
    readonly cpuStagesMs: readonly StageMean[];
    readonly gpuStagesMs: readonly StageMean[] | null;
    readonly gpuMs: number;
    readonly gpu: {
        readonly name: string;
        readonly tier: string;
        readonly source: string;
        readonly score: number;
    };
    readonly physics: {
        readonly bodies: number;
        readonly stepMs: number;
        readonly catchUpSteps: number;
        readonly droppedSeconds: number;
        readonly backend: string;
    } | null;
    readonly entities: number;
}
const LOG_SOURCE = 'Benchmark';
const DEFAULT_SECONDS = 20;
const PROGRESS_INTERVAL_MS = 250;
const MAX_SAMPLES = 60 * 60 * 5;
const TIER_LABEL = { low: 'baixa', mid: 'média', high: 'alta' } as const;
const TIER_SOURCE_LABEL = { forced: 'forçada', measured: 'medida', cached: 'medida em sessão anterior', heuristic: 'pelo nome' } as const;
function fmt(value: number, digits = 1): string {
    return value.toFixed(digits).replace('.', ',');
}
function percentile(sorted: Float64Array, count: number, p: number): number {
    if (count === 0)
        return 0;
    return sorted[Math.min(count - 1, Math.max(0, Math.round(p * (count - 1))))];
}
export function formatBenchmarkReport(report: BenchmarkReport): string[] {
    const lines: string[] = [];
    const { frameMs } = report;
    lines.push(`${fmt(report.durationSeconds, 0)} s · ${report.frames} frames · ${fmt(report.fps, 1)} fps · frame médio ${fmt(frameMs.mean)} ms · p50 ${fmt(frameMs.p50)} · p95 ${fmt(frameMs.p95)} · p99 ${fmt(frameMs.p99)} · máx ${fmt(frameMs.max)} ms`);
    lines.push(`Governador: nível médio ${fmt(report.qualityLevel.mean)} (máx ${report.qualityLevel.max}) · escala média ${Math.round(report.renderScaleMean * 100)}% · GPU ${report.gpu.name || 'oculta'} · classe ${report.gpu.tier} (${report.gpu.source}${report.gpu.score > 0 ? `, score ${fmt(report.gpu.score, 2)}` : ''})`);
    lines.push(`CPU por faixa (média): ${CPU_LANES.map((lane) => `${CPU_LANE_SHORT[lane]} ${fmt(report.cpuLanesMs[lane], 2)}`).join(' · ')} ms`);
    lines.push(`CPU do render por etapa (média): ${report.cpuStagesMs.slice(0, 6).map((entry) => `${entry.stage} ${fmt(entry.ms, 2)}`).join(' · ')} ms`);
    if (report.gpuStagesMs) {
        lines.push(`GPU por etapa (média): ${report.gpuStagesMs.slice(0, 8).map((entry) => `${entry.stage} ${fmt(entry.ms, 2)}`).join(' · ')} · total ${fmt(report.gpuMs, 2)} ms`);
    }
    else {
        lines.push('GPU por etapa: indisponível (o navegador não expõe timer queries).');
    }
    if (report.physics) {
        const { physics } = report;
        lines.push(`Física: ${physics.bodies} corpos · ${fmt(physics.stepMs, 3)} ms/passo · ${physics.catchUpSteps} ${physics.catchUpSteps === 1 ? 'passo largo' : 'passos largos'} · ${Math.round(physics.droppedSeconds * 1000)} ms descartados · ${physics.backend}`);
    }
    lines.push(`Cena: ${report.entities} atores.`);
    return lines;
}
export class PlaytestBenchmark {
    state: BenchmarkState = 'idle';
    progress = 0;
    report: BenchmarkReport | null = null;
    message = 'Com o jogo rodando, mede 20 s e resume p50/p95 do frame, o nível médio do governador e o custo por etapa.';
    private readonly intervals = new Float64Array(MAX_SAMPLES);
    private count = 0;
    private levelSum = 0;
    private levelMax = 0;
    private scaleSum = 0;
    private scaleSamples = 0;
    private readonly laneSums = new Float64Array(CPU_LANES.length);
    private laneSamples = 0;
    private readonly cpuStageSums = new Float64Array(FRAME_STAGES.length);
    private readonly gpuStageSums = new Float64Array(FRAME_STAGES.length);
    private gpuSamples = 0;
    private statsSamples = 0;
    private catchUpSteps = 0;
    private droppedSeconds = 0;
    private token = 0;
    constructor(private readonly session: EditorSession, private readonly notify: () => void) { }
    get isRunning(): boolean {
        return this.state === 'running';
    }
    async run(seconds = DEFAULT_SECONDS): Promise<BenchmarkReport | null> {
        if (this.state === 'running')
            return null;
        const { session } = this;
        if (session.playtest.state !== 'playing') {
            this.state = 'failed';
            this.message = 'Inicie o playtest antes: o benchmark mede o jogo em andamento.';
            this.notify();
            return null;
        }
        const token = ++this.token;
        this.resetAccumulators();
        this.state = 'running';
        this.progress = 0;
        this.message = `Medindo ${seconds} s do jogo…`;
        this.notify();
        session.frameProfile.reset();
        const unsubscribeFrame = session.frameProfile.onFrame((profile) => {
            if (profile.frameIntervalMs <= 0)
                return;
            if (this.count < MAX_SAMPLES)
                this.intervals[this.count++] = profile.frameIntervalMs;
            this.levelSum += profile.qualityLevel;
            this.levelMax = Math.max(this.levelMax, profile.qualityLevel);
            for (let i = 0; i < CPU_LANES.length; i++)
                this.laneSums[i] += profile.laneMs[i];
            this.laneSamples++;
            const world = session.playtest.physics?.world;
            if (world) {
                this.catchUpSteps += world.stats.catchUpSteps;
                this.droppedSeconds += world.stats.droppedSeconds;
            }
        });
        const unsubscribeStats = session.subscribeStats(() => {
            const { stats } = session;
            this.scaleSum += stats.renderScale;
            this.scaleSamples++;
            for (let i = 0; i < FRAME_STAGES.length; i++)
                this.cpuStageSums[i] += stats.cpuStageMs[i];
            this.statsSamples++;
            if (stats.gpuStageMs) {
                for (let i = 0; i < FRAME_STAGES.length; i++)
                    this.gpuStageSums[i] += stats.gpuStageMs[i];
                this.gpuSamples++;
            }
        });
        const started = performance.now();
        const durationMs = seconds * 1000;
        try {
            while (performance.now() - started < durationMs) {
                await new Promise((resolve) => setTimeout(resolve, PROGRESS_INTERVAL_MS));
                if (token !== this.token)
                    return null;
                if (session.playtest.state !== 'playing') {
                    this.state = 'failed';
                    this.message = 'O playtest parou no meio da medição; o benchmark foi cancelado.';
                    this.notify();
                    return null;
                }
                this.progress = Math.min(1, (performance.now() - started) / durationMs);
                this.notify();
            }
        }
        finally {
            unsubscribeFrame();
            unsubscribeStats();
        }
        const report = this.buildReport((performance.now() - started) / 1000);
        this.report = report;
        this.state = 'done';
        this.progress = 1;
        this.message = `Medição concluída: ${report.frames} frames, p50 ${fmt(report.frameMs.p50)} ms, p95 ${fmt(report.frameMs.p95)} ms, nível médio ${fmt(report.qualityLevel.mean)}.`;
        for (const line of formatBenchmarkReport(report))
            session.log.info(LOG_SOURCE, line);
        this.notify();
        return report;
    }
    cancel(): void {
        if (this.state !== 'running')
            return;
        this.token++;
        this.state = 'idle';
        this.progress = 0;
        this.message = 'Medição cancelada.';
        this.notify();
    }
    private resetAccumulators(): void {
        this.count = 0;
        this.levelSum = 0;
        this.levelMax = 0;
        this.scaleSum = 0;
        this.scaleSamples = 0;
        this.laneSums.fill(0);
        this.laneSamples = 0;
        this.cpuStageSums.fill(0);
        this.gpuStageSums.fill(0);
        this.gpuSamples = 0;
        this.statsSamples = 0;
        this.catchUpSteps = 0;
        this.droppedSeconds = 0;
    }
    private buildReport(durationSeconds: number): BenchmarkReport {
        const { session } = this;
        const { stats } = session;
        const count = this.count;
        const sorted = this.intervals.slice(0, count).sort();
        let sum = 0;
        let max = 0;
        for (let i = 0; i < count; i++) {
            sum += sorted[i];
            max = Math.max(max, sorted[i]);
        }
        const mean = count > 0 ? sum / count : 0;
        const lanes = {} as Record<CpuLane, number>;
        for (let i = 0; i < CPU_LANES.length; i++)
            lanes[CPU_LANES[i]] = this.laneSamples > 0 ? this.laneSums[i] / this.laneSamples : 0;
        const stageMeans = (sums: Float64Array, samples: number): StageMean[] => FRAME_STAGES.map((stage, index) => ({ stage, ms: samples > 0 ? sums[index] / samples : 0 }))
            .filter((entry) => entry.ms > 0)
            .sort((a, b) => b.ms - a.ms);
        const gpuStages = this.gpuSamples > 0 ? stageMeans(this.gpuStageSums, this.gpuSamples) : null;
        const world = session.playtest.physics?.world ?? null;
        return {
            finishedAt: Date.now(),
            durationSeconds,
            frames: count,
            fps: mean > 0 ? 1000 / mean : 0,
            frameMs: { mean, p50: percentile(sorted, count, 0.5), p95: percentile(sorted, count, 0.95), p99: percentile(sorted, count, 0.99), max },
            qualityLevel: { mean: this.laneSamples > 0 ? this.levelSum / this.laneSamples : 0, max: this.levelMax },
            renderScaleMean: this.scaleSamples > 0 ? this.scaleSum / this.scaleSamples : stats.renderScale,
            cpuLanesMs: lanes,
            cpuStagesMs: stageMeans(this.cpuStageSums, this.statsSamples),
            gpuStagesMs: gpuStages,
            gpuMs: gpuStages ? gpuStages.reduce((total, entry) => total + entry.ms, 0) : 0,
            gpu: { name: stats.gpuName, tier: TIER_LABEL[stats.gpuTier], source: TIER_SOURCE_LABEL[stats.gpuTierSource], score: stats.gpuScore },
            physics: world
                ? {
                    bodies: world.stats.bodies,
                    stepMs: world.stats.stepMsAverage,
                    catchUpSteps: this.catchUpSteps,
                    droppedSeconds: this.droppedSeconds,
                    backend: PHYSICS_BACKEND_LABELS[world.stats.backend],
                }
                : null,
            entities: session.scene.entityCount,
        };
    }
}
