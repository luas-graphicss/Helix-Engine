'use client';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
function formatPosition(values: ArrayLike<number>): string {
    return Array.from(values, (v) => v.toFixed(1)).join(', ');
}
export function ViewportStatsOverlay() {
    const session = useEditorState();
    const { stats, camera } = session;
    const cpuMs = stats.cpuStageMs.reduce((sum, value) => sum + value, 0);
    return (<dl className="pointer-events-none absolute bottom-2 left-2 grid grid-cols-[auto_auto] gap-x-3 gap-y-px rounded-sm bg-surface-sunken/70 px-2 py-1 font-mono text-[10px] leading-4 text-muted-foreground backdrop-blur-sm">
      <dt className="text-muted-foreground/60">FPS</dt>
      <dd className="text-foreground/80">{stats.fps}</dd>
      <dt className="text-muted-foreground/60">Draws</dt>
      <dd>{stats.drawCalls}</dd>
      <dt className="text-muted-foreground/60">Tris</dt>
      <dd>{stats.triangles.toLocaleString('pt-BR')}</dd>
      <dt className="text-muted-foreground/60">CPU</dt>
      <dd>{cpuMs.toFixed(1)} ms</dd>
      {stats.gpuStageMs && (<>
          <dt className="text-muted-foreground/60">GPU</dt>
          <dd>{stats.gpuMs.toFixed(1)} ms</dd>
        </>)}
      <dt className="text-muted-foreground/60">Buffer</dt>
      <dd>
        {stats.width} × {stats.height}
      </dd>
      {stats.cloudWidth > 0 && (<>
          <dt className="text-muted-foreground/60">Nuvens</dt>
          <dd>
            {stats.cloudWidth} × {stats.cloudHeight}
          </dd>
        </>)}
      <dt className="text-muted-foreground/60">Câmera</dt>
      <dd>{formatPosition(camera.position)}</dd>
    </dl>);
}
