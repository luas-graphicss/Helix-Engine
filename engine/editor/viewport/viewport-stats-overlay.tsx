'use client';
import { TriangleAlert } from 'lucide-react';
import { useEditorSession, useViewportStats } from '@/engine/editor/session/editor-session-context';
function formatPosition(values: ArrayLike<number>): string {
    return Array.from(values, (v) => v.toFixed(1)).join(', ');
}
const TIER_LABEL = { low: 'baixa', mid: 'média', high: 'alta' } as const;
export function ViewportStatsOverlay() {
    const { camera } = useEditorSession();
    const stats = useViewportStats();
    const cpuMs = stats.cpuStageMs.reduce((sum, value) => sum + value, 0);
    const pixelShare = stats.pixelRatio * stats.pixelRatio;
    return (<div className="pointer-events-none absolute bottom-2 left-2 flex max-w-sm flex-col gap-1">
      {stats.softwareRenderer && (<p role="alert" className="flex items-start gap-1.5 rounded-sm border border-destructive/60 bg-destructive/15 px-2 py-1 text-[10px] leading-4 text-pretty text-destructive backdrop-blur-sm">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden/>
          <span>
            Renderização por software detectada — ative a aceleração de hardware em chrome://settings/system ou atualize o driver de vídeo.
            Nenhuma otimização chega a 60 FPS sem GPU.
          </span>
        </p>)}
      {stats.shadersPending > 0 && (<p role="status" className="rounded-sm bg-surface-sunken/70 px-2 py-1 font-mono text-[10px] leading-4 text-muted-foreground backdrop-blur-sm">
          Compilando shaders em paralelo: {stats.shadersTotal - stats.shadersPending} de {stats.shadersTotal}
        </p>)}
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-px rounded-sm bg-surface-sunken/70 px-2 py-1 font-mono text-[10px] leading-4 text-muted-foreground backdrop-blur-sm">
        <dt className="text-muted-foreground/60">FPS</dt>
        <dd className="text-foreground/80">{stats.fps}</dd>
        <dt className="text-muted-foreground/60">Draws</dt>
        <dd>{stats.drawCalls}</dd>
        <dt className="text-muted-foreground/60">Tris</dt>
        <dd>{stats.triangles.toLocaleString('pt-BR')}</dd>
        {stats.myriad.instances > 0 && (<>
            <dt className="text-muted-foreground/60">Clusters</dt>
            <dd>
              {stats.myriad.clusters.toLocaleString('pt-BR')} <span className="text-muted-foreground/60">em {stats.myriad.instances.toLocaleString('pt-BR')} inst.</span>
            </dd>
          </>)}
        <dt className="text-muted-foreground/60">CPU</dt>
        <dd>{cpuMs.toFixed(1)} ms</dd>
        {stats.gpuStageMs && (<>
            <dt className="text-muted-foreground/60">GPU</dt>
            <dd>{stats.gpuMs.toFixed(1)} ms</dd>
          </>)}
        <dt className="text-muted-foreground/60">Buffer</dt>
        <dd>
          {stats.width} × {stats.height}
          {stats.pixelRatio > 1.01 && (<span className="text-muted-foreground/60">
              {' '}
              · DPR {stats.pixelRatio.toFixed(2)} ({pixelShare.toFixed(2)}× pixels)
            </span>)}
        </dd>
        {stats.cloudWidth > 0 && (<>
            <dt className="text-muted-foreground/60">Nuvens</dt>
            <dd>
              {stats.cloudWidth} × {stats.cloudHeight}
            </dd>
          </>)}
        <dt className="text-muted-foreground/60">GPU</dt>
        <dd className="truncate" title={stats.gpuName}>
          {stats.gpuName || 'Oculta pelo navegador'} <span className="text-muted-foreground/60">· classe {TIER_LABEL[stats.gpuTier]}</span>
        </dd>
        <dt className="text-muted-foreground/60">Câmera</dt>
        <dd>{formatPosition(camera.position)}</dd>
      </dl>
    </div>);
}
