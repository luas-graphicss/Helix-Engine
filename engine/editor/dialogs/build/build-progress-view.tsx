'use client';
import { Check, LoaderCircle } from 'lucide-react';
import { BUILD_STAGES, formatEta, type BuildProgressSnapshot } from '@/engine/build/build-progress';
import type { BuildOptions } from '@/engine/build/build-targets';
import { buildPlatformOf } from '@/engine/build/build-targets';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { BuildLog } from './build-log';
function formatElapsed(startedAt: number | null): string {
    if (!startedAt)
        return '0 s';
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}
export function BuildProgressView({ progress, options }: {
    progress: BuildProgressSnapshot;
    options: BuildOptions;
}) {
    const percent = Math.round(progress.totalFraction * 100);
    const currentIndex = BUILD_STAGES.findIndex((stage) => stage.id === progress.stage);
    const current = currentIndex >= 0 ? BUILD_STAGES[currentIndex] : null;
    const platform = buildPlatformOf(options.platform);
    return (<div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-2" role="group" aria-label="Progresso da compilação">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            {options.gameName.trim() || 'Jogo'} · {platform.label}
          </span>
          <span className="font-mono text-2xs text-muted-foreground tabular-nums">
            {percent}% · restam {formatEta(progress.etaSeconds)}
          </span>
        </div>
        <div className={cn('h-2 overflow-hidden rounded-full', WELL_CLASS)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progresso total">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }}/>
        </div>
        <p className="min-h-4 text-2xs text-muted-foreground" aria-live="polite">
          {current ? `${current.label}${progress.detail ? ` · ${progress.detail}` : ''}` : 'Começando…'}
        </p>
      </div>

      <ol className="flex flex-col gap-1" aria-label="Etapas">
        {BUILD_STAGES.map((stage, index) => {
            const done = progress.completed.has(stage.id);
            const active = stage.id === progress.stage;
            return (<li key={stage.id} className={cn('flex items-center gap-2.5 rounded-sm px-2 py-1 text-2xs', active && 'bg-surface-sunken/60 text-foreground', done && 'text-muted-foreground', !done && !active && 'text-muted-foreground/60')}>
              <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', done ? 'border-success/60 bg-success/15 text-success' : active ? 'border-primary/60 text-primary' : 'border-border')} aria-hidden>
                {done ? <Check className="size-2.5"/> : active ? <LoaderCircle className="size-2.5 animate-spin"/> : <span className="size-1 rounded-full bg-current opacity-40"/>}
              </span>
              <span className="flex-1 truncate">{stage.label}</span>
              {active && (<span className="w-24 shrink-0">
                  <span className={cn('block h-1 overflow-hidden rounded-full', WELL_CLASS)}>
                    <span className="block h-full rounded-full bg-primary/80 transition-[width] duration-200" style={{ width: `${Math.round(progress.stageFraction * 100)}%` }}/>
                  </span>
                </span>)}
              <span className="sr-only">{done ? 'concluída' : active ? 'em andamento' : 'pendente'}</span>
              <span className="w-10 shrink-0 text-right font-mono text-3xs text-muted-foreground/70 tabular-nums">{index + 1}/{BUILD_STAGES.length}</span>
            </li>);
        })}
      </ol>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Registro</span>
          <span className="font-mono text-3xs text-muted-foreground tabular-nums">decorridos {formatElapsed(progress.startedAt)}</span>
        </div>
        <BuildLog lines={progress.log}/>
      </div>
    </div>);
}
