'use client';
import { useEffect, useRef, useState } from 'react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { CPU_LANES, CPU_LANE_SHORT, type CpuLane } from '@/engine/renderer/stats/frame-profile';
import { FRAME_STAGES, type FrameStage } from '@/engine/renderer/stats/frame-stages';
import { QUALITY_LADDER } from '@/engine/renderer/quality/frame-governor';
import { PHYSICS_BACKEND_LABELS } from '@/engine/physics/world/physics-world';
import { cn } from '@/lib/utils';
const REFRESH_MS = 100;
const BUDGET_MS = 1000 / 60;
const BAR_WIDTH_PX = 72;
const STAGE_SHORT: Record<FrameStage, string> = {
    cull: 'cull',
    sky: 'céu',
    shadows: 'sombras',
    probe: 'sonda',
    prepass: 'prepass',
    virtual: 'virtual',
    clouds: 'nuvens',
    mask: 'máscara',
    reflections: 'reflexos',
    meshes: 'malhas',
    terrain: 'terreno',
    overlay: 'transp.',
    post: 'pós',
    editor: 'editor',
    final: 'final',
};
const TIER_LABEL = { low: 'baixa', mid: 'média', high: 'alta' } as const;
const TIER_SOURCE_LABEL = { forced: 'forçada', measured: 'medida', cached: 'medida (cache)', heuristic: 'pelo nome' } as const;
function ms(value: number, digits = 1): string {
    return value.toFixed(digits).replace('.', ',');
}
function Bar({ value, budget, tone = 'primary' }: {
    value: number;
    budget: number;
    tone?: 'primary' | 'muted' | 'warning';
}) {
    const ratio = budget > 0 ? Math.min(2, value / budget) : 0;
    const over = ratio > 1;
    return (<span className="relative inline-block h-2 shrink-0 overflow-hidden rounded-[1px] bg-foreground/10" style={{ width: BAR_WIDTH_PX }} aria-hidden>
      <span className={cn('absolute inset-y-0 left-0', over ? 'bg-warning' : tone === 'warning' ? 'bg-warning/80' : tone === 'muted' ? 'bg-foreground/40' : 'bg-primary/80')} style={{ width: `${(ratio / 2) * 100}%` }}/>
      <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/35"/>
    </span>);
}
function Row({ label, value, budget, tone }: {
    label: string;
    value: number;
    budget: number;
    tone?: 'primary' | 'muted' | 'warning';
}) {
    return (<li className="flex items-center gap-1.5 leading-none">
      <span className="w-14 truncate text-muted-foreground">{label}</span>
      <Bar value={value} budget={budget} tone={tone}/>
      <span className="w-10 text-right tabular-nums">{ms(value)}</span>
    </li>);
}
interface Snapshot {
    frameMs: number;
    p50: number;
    p95: number;
    fps: number;
    level: number;
    levelAverage: number;
    renderScale: number;
    loadMs: number;
    lanes: number[];
    gpuStages: Array<{
        stage: FrameStage;
        ms: number;
    }> | null;
    gpuMs: number;
    gpuName: string;
    gpuTier: string;
    gpuSource: string;
    gpuScore: number;
    software: boolean;
    pending: {
        shadowFaces: number;
        terrainTiles: number;
        grass: number;
        shaders: number;
        lod: number;
    };
    physics: {
        steps: number;
        stepMs: number;
        bodies: number;
        awake: number;
        joints: number;
        dropped: number;
        catchUp: boolean;
        backend: string;
    } | null;
    clockRatio: number | null;
    playing: boolean;
    samples: number;
}
interface ClockTracker {
    wall: number[];
    simulated: number[];
}
const CLOCK_WINDOW_MS = 1000;
function clockRatio(tracker: ClockTracker, session: EditorSession): number | null {
    const { playtest } = session;
    if (playtest.state !== 'playing') {
        tracker.wall.length = 0;
        tracker.simulated.length = 0;
        return null;
    }
    const now = performance.now();
    tracker.wall.push(now);
    tracker.simulated.push(playtest.elapsedSeconds);
    while (tracker.wall.length > 2 && now - tracker.wall[0] > CLOCK_WINDOW_MS) {
        tracker.wall.shift();
        tracker.simulated.shift();
    }
    if (tracker.wall.length < 2)
        return null;
    const wallSeconds = (now - tracker.wall[0]) / 1000;
    const simulatedSeconds = playtest.elapsedSeconds - tracker.simulated[0];
    if (wallSeconds <= 0)
        return null;
    return simulatedSeconds / wallSeconds / Math.max(playtest.timeScale, 1e-3);
}
function snapshot(session: EditorSession, tracker: ClockTracker): Snapshot {
    const { frameProfile: profile, stats } = session;
    const governor = session.frameGovernor;
    const gpu = stats.gpuStageMs;
    const gpuStages = gpu
        ? FRAME_STAGES.map((stage, index) => ({ stage, ms: gpu[index] }))
            .filter((entry) => entry.ms >= 0.05)
            .sort((a, b) => b.ms - a.ms)
            .slice(0, 6)
        : null;
    const world = session.playtest.physics?.world ?? null;
    return {
        frameMs: profile.frameIntervalAverageMs,
        p50: profile.percentile(0.5),
        p95: profile.percentile(0.95),
        fps: profile.fps,
        level: governor?.level ?? 0,
        levelAverage: profile.qualityLevelAverage,
        renderScale: stats.renderScale,
        loadMs: governor?.loadMs ?? 0,
        lanes: Array.from(profile.laneAverageMs),
        gpuStages,
        gpuMs: stats.gpuMs,
        gpuName: stats.gpuName,
        gpuTier: TIER_LABEL[stats.gpuTier],
        gpuSource: TIER_SOURCE_LABEL[stats.gpuTierSource],
        gpuScore: stats.gpuScore,
        software: stats.softwareRenderer,
        pending: {
            shadowFaces: stats.localShadowPostponed + stats.localShadowDeferred,
            terrainTiles: stats.terrainCachePending,
            grass: stats.grassPending,
            shaders: stats.shadersPending,
            lod: stats.lodPending,
        },
        physics: world
            ? {
                steps: world.stats.stepsLastAdvance,
                stepMs: world.stats.stepMsAverage,
                bodies: world.stats.bodies,
                awake: world.stats.awake,
                joints: world.stats.joints,
                dropped: world.stats.droppedSeconds,
                catchUp: world.stats.catchUpSteps > 0,
                backend: PHYSICS_BACKEND_LABELS[world.stats.backend],
            }
            : null,
        clockRatio: clockRatio(tracker, session),
        playing: session.playtest.state === 'playing',
        samples: profile.sampleCount,
    };
}
export function PerformanceHud() {
    const session = useSessionTopic('view');
    const visible = session.render.perfHud;
    const [data, setData] = useState<Snapshot | null>(null);
    const tracker = useRef<ClockTracker>({ wall: [], simulated: [] });
    useEffect(() => {
        if (!visible) {
            setData(null);
            return;
        }
        const clock = tracker.current;
        clock.wall.length = 0;
        clock.simulated.length = 0;
        setData(snapshot(session, clock));
        const handle = window.setInterval(() => setData(snapshot(session, clock)), REFRESH_MS);
        return () => window.clearInterval(handle);
    }, [session, visible]);
    if (!visible || !data)
        return null;
    const budget = BUDGET_MS;
    const maxLevel = QUALITY_LADDER.length - 1;
    const overBudget = data.frameMs > budget * 1.12;
    return (<aside aria-label="HUD de orçamento do frame" className="pointer-events-none absolute top-12 left-2 flex w-[19rem] max-w-[calc(100%-1rem)] flex-col gap-1.5 rounded-sm border border-border/70 bg-surface-overlay/92 p-2 font-mono text-2xs text-foreground shadow-overlay backdrop-blur-sm">
      <header className="flex items-baseline justify-between gap-2 leading-none">
        <span className="flex items-baseline gap-1.5">
          <span className={cn('text-sm font-medium tabular-nums', overBudget ? 'text-warning' : 'text-success')}>{ms(data.frameMs)} ms</span>
          <span className="text-muted-foreground tabular-nums">{Math.round(data.fps)} fps</span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          p50 {ms(data.p50)} · p95 {ms(data.p95)}
        </span>
      </header>

      <div className="flex items-center justify-between gap-2 leading-none">
        <span>
          <span className="text-muted-foreground">nível </span>
          <span className={cn('tabular-nums', data.level >= 3 ? 'text-warning' : '')}>
            {data.level}/{maxLevel}
          </span>
          <span className="text-muted-foreground"> (média {data.levelAverage.toFixed(1).replace('.', ',')})</span>
        </span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">escala </span>
          {Math.round(data.renderScale * 100)}%
        </span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">carga </span>
          {ms(data.loadMs)}
        </span>
      </div>

      <ul className="flex flex-col gap-0.5" aria-label="CPU por faixa">
        {CPU_LANES.map((lane: CpuLane, index) => (<Row key={lane} label={CPU_LANE_SHORT[lane]} value={data.lanes[index]} budget={budget} tone={lane === 'ui' ? 'muted' : 'primary'}/>))}
      </ul>

      {data.gpuStages ? (<ul className="flex flex-col gap-0.5 border-t border-border/60 pt-1.5" aria-label="GPU por etapa">
          <li className="flex items-center justify-between leading-none text-muted-foreground">
            <span>GPU</span>
            <span className="tabular-nums">{ms(data.gpuMs)} ms</span>
          </li>
          {data.gpuStages.map((entry) => (<Row key={entry.stage} label={STAGE_SHORT[entry.stage]} value={entry.ms} budget={budget} tone="warning"/>))}
        </ul>) : (<p className="border-t border-border/60 pt-1.5 leading-snug text-muted-foreground">GPU por etapa indisponível: o navegador não expõe timer queries.</p>)}

      <div className="flex flex-col gap-0.5 border-t border-border/60 pt-1.5 leading-snug">
        <p className="truncate">
          <span className="text-muted-foreground">GPU </span>
          <span className={cn(data.software && 'text-warning')}>{data.gpuName || 'oculta pelo navegador'}</span>
        </p>
        <p className="text-muted-foreground">
          classe <span className="text-foreground">{data.gpuTier}</span> · {data.gpuSource}
          {data.gpuScore > 0 && <span className="tabular-nums"> · score {data.gpuScore.toFixed(2).replace('.', ',')}</span>}
          {data.software && ' · renderização por software'}
        </p>
      </div>

      <p className="border-t border-border/60 pt-1.5 leading-snug text-muted-foreground">
        pendências: <span className="text-foreground tabular-nums">{data.pending.shadowFaces}</span> faces de sombra · <span className="text-foreground tabular-nums">{data.pending.terrainTiles}</span> tiles de terreno ·{' '}
        <span className="text-foreground tabular-nums">{data.pending.grass}</span> grama · <span className="text-foreground tabular-nums">{data.pending.lod}</span> LOD · <span className="text-foreground tabular-nums">{data.pending.shaders}</span> shaders
      </p>

      {data.physics && (<p className="border-t border-border/60 pt-1.5 leading-snug text-muted-foreground">
          física: <span className="text-foreground tabular-nums">{data.physics.steps}</span> {data.physics.steps === 1 ? 'passo' : 'passos'} · <span className="text-foreground tabular-nums">{ms(data.physics.stepMs, 2)}</span> ms/passo ·{' '}
            <span className="text-foreground tabular-nums">{data.physics.awake}</span>/<span className="tabular-nums">{data.physics.bodies}</span> corpos
            {data.physics.joints > 0 && (<>
                {' '}
                · <span className="text-foreground tabular-nums">{data.physics.joints}</span> {data.physics.joints === 1 ? 'junta' : 'juntas'}
              </>)}{' '}
            · {data.physics.backend}
          {data.physics.catchUp && <span className="text-warning"> · passo largo</span>}
          {data.physics.dropped > 0 && <span className="text-warning"> · {Math.round(data.physics.dropped * 1000)} ms descartados</span>}
          {data.clockRatio !== null && (<span className={cn(data.clockRatio < 0.9 ? 'text-warning' : '')}>
              {' '}
              · relógio <span className="tabular-nums">{Math.round(data.clockRatio * 100)}%</span>
              {data.clockRatio < 0.9 && ' (câmera lenta)'}
            </span>)}
        </p>)}

      <p className="leading-snug text-muted-foreground/80">
        {data.playing ? 'em jogo' : 'fora do jogo'} · {data.samples} frames no histórico · F3 esconde
      </p>
    </aside>);
}
