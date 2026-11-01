'use client';
import { useState } from 'react';
import { Check, Copy, Gauge, LoaderCircle, Square } from 'lucide-react';
import { FOCUS_RING_CLASS, GHOST_ACTION_CLASS } from '@/engine/ui/surface-styles';
import { CPU_LANES, CPU_LANE_SHORT } from '@/engine/renderer/stats/frame-profile';
import { cn } from '@/lib/utils';
import type { DebugModeController } from '../debug-mode';
import { formatBenchmarkReport, type BenchmarkReport } from '../bench/playtest-benchmark';
import { DebugSection } from './debug-section';
const SECONDS = 20;
function fmt(value: number, digits = 1): string {
    return value.toFixed(digits).replace('.', ',');
}
function Metric({ label, value, tone }: {
    label: string;
    value: string;
    tone?: 'warning' | 'success';
}) {
    return (<div className="flex min-w-0 flex-col gap-0.5 rounded-sm border border-border bg-surface-sunken/40 px-2 py-1.5">
      <span className="truncate text-3xs text-muted-foreground">{label}</span>
      <span className={cn('font-mono text-xs tabular-nums', tone === 'warning' && 'text-warning', tone === 'success' && 'text-success')}>{value}</span>
    </div>);
}
function ReportView({ report }: {
    report: BenchmarkReport;
}) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(formatBenchmarkReport(report).join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
        catch {
        }
    };
    const p95Over = report.frameMs.p95 > (1000 / 60) * 1.12;
    return (<div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <Metric label="fps" value={fmt(report.fps, 0)}/>
        <Metric label="frame p50" value={`${fmt(report.frameMs.p50)} ms`}/>
        <Metric label="frame p95" value={`${fmt(report.frameMs.p95)} ms`} tone={p95Over ? 'warning' : 'success'}/>
        <Metric label="p99 / máx" value={`${fmt(report.frameMs.p99, 0)} / ${fmt(report.frameMs.max, 0)}`}/>
        <Metric label="nível médio" value={`${fmt(report.qualityLevel.mean)} (máx ${report.qualityLevel.max})`}/>
        <Metric label="escala média" value={`${Math.round(report.renderScaleMean * 100)}%`}/>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-3xs sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">CPU por faixa (ms, média)</dt>
          <dd className="text-foreground">{CPU_LANES.map((lane) => `${CPU_LANE_SHORT[lane]} ${fmt(report.cpuLanesMs[lane], 2)}`).join(' · ')}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">GPU por etapa (ms, média)</dt>
          <dd className="text-foreground">{report.gpuStagesMs ? `${report.gpuStagesMs.slice(0, 6).map((entry) => `${entry.stage} ${fmt(entry.ms, 2)}`).join(' · ')} · total ${fmt(report.gpuMs, 2)}` : 'sem timer queries neste navegador'}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">GPU</dt>
          <dd className="text-foreground">
            {report.gpu.name || 'oculta'} · classe {report.gpu.tier} ({report.gpu.source}
            {report.gpu.score > 0 ? `, score ${fmt(report.gpu.score, 2)}` : ''})
          </dd>
        </div>
        {report.physics && (<div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Física</dt>
            <dd className="text-foreground">
              {report.physics.bodies} corpos · {fmt(report.physics.stepMs, 3)} ms/passo · {report.physics.catchUpSteps} largos · {Math.round(report.physics.droppedSeconds * 1000)} ms descartados · {report.physics.backend}
            </dd>
          </div>)}
      </dl>
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs text-muted-foreground">
          Medido {new Date(report.finishedAt).toLocaleTimeString('pt-BR')} · {report.frames} frames em {fmt(report.durationSeconds, 0)} s · {report.entities} atores. O relatório completo está no console.
        </span>
        <button type="button" onClick={() => void copy()} className={cn('flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-2xs text-foreground', GHOST_ACTION_CLASS, FOCUS_RING_CLASS)}>
          {copied ? <Check className="size-3 text-primary" aria-hidden/> : <Copy className="size-3" aria-hidden/>}
          {copied ? 'Copiado' : 'Copiar relatório'}
        </button>
      </div>
    </div>);
}
export function BenchmarkSection({ debug }: {
    debug: DebugModeController;
}) {
    const { benchmark } = debug;
    const running = benchmark.isRunning;
    const disabled = debug.isBusy && !running;
    return (<DebugSection title="Benchmark" description={`Mede ${SECONDS} s do jogo (iniciando o playtest do jogo instalado, se estiver parado) e imprime p50/p95 do frame, nível médio do governador e ms por etapa de CPU e GPU no console. Pressione F3 para ver o HUD de orçamento ao vivo.`}>
      <div className="flex flex-col gap-2">
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-sm border border-border bg-surface-sunken/60 px-2.5 py-1.5 shadow-well">
          {running ? <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden/> : <Gauge className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>}
          <span className="min-w-0 flex-1 text-2xs leading-snug text-pretty text-foreground">{benchmark.message}</span>
          {running ? (<button type="button" onClick={() => benchmark.cancel()} className={cn('flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-2xs text-foreground', GHOST_ACTION_CLASS, FOCUS_RING_CLASS)}>
              <Square className="size-3" aria-hidden/>
              Cancelar
            </button>) : (<button type="button" onClick={() => void debug.runBenchmark(SECONDS)} disabled={disabled} className={cn('flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-2xs font-medium text-primary disabled:opacity-45', GHOST_ACTION_CLASS, FOCUS_RING_CLASS)}>
              <Gauge className="size-3" aria-hidden/>
              Rodar benchmark ({SECONDS} s)
            </button>)}
        </div>
        {running && (<div className="h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
            <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(benchmark.progress * 100)}%` }}/>
          </div>)}
        {benchmark.report && !running && <ReportView report={benchmark.report}/>}
      </div>
    </DebugSection>);
}
