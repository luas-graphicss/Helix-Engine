'use client';
import { CircleCheck, Cpu, Monitor, Bell, Clock, TriangleAlert, CircleAlert, Atom } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorState, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { formatTimeOfDay } from '@/engine/core/environment/celestial';
export function StatusBar() {
    const session = useEditorState();
    const stats = useViewportStats();
    const { log, playtest } = session;
    const { sky } = session.scene;
    const physicsStats = playtest.physics?.world.stats ?? null;
    const frameTimeMs = stats.fps > 0 ? (1000 / stats.fps).toFixed(1) : '—';
    const lastEntry = log.entries.at(-1) ?? null;
    const issues = log.count('warn') + log.count('error');
    const StatusIcon = lastEntry?.level === 'error' ? CircleAlert : lastEntry?.level === 'warn' ? TriangleAlert : CircleCheck;
    return (<footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-surface-sunken px-2 font-mono text-[10px] text-muted-foreground">
      <span className="flex min-w-0 items-center gap-1.5 text-foreground">
        <StatusIcon className={cn('size-3 shrink-0', lastEntry?.level === 'error' ? 'text-destructive' : lastEntry?.level === 'warn' ? 'text-warning' : 'text-primary')} aria-hidden/>
        <span className="truncate">{lastEntry?.message ?? 'Pronto'}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5" title="Hora do céu">
        <Clock className="size-3" aria-hidden/>
        {formatTimeOfDay(sky.timeOfDay)}
        {sky.cycleSpeed > 0 && <span className="text-primary">▸</span>}
      </span>
      {physicsStats && (<span className={cn('flex shrink-0 items-center gap-1.5', playtest.state === 'playing' ? 'text-primary' : 'text-warning')} title="Física: corpos ativos / total · pontos de contato · custo do passo">
          <Atom className="size-3" aria-hidden/>
          {physicsStats.awake}/{physicsStats.bodies} corpos · {physicsStats.contactPoints} contatos · {physicsStats.stepMs.toFixed(2)} ms
        </span>)}

      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <Monitor className="size-3" aria-hidden/>
        WebGL2
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Cpu className="size-3" aria-hidden/>
        {frameTimeMs} ms
      </span>
      <span className="shrink-0">{stats.fps} fps</span>
      <span className={cn('flex shrink-0 items-center gap-1.5', issues > 0 && 'text-warning')} title="Avisos e erros no console">
        <Bell className="size-3" aria-hidden/>
        {issues}
      </span>
    </footer>);
}
