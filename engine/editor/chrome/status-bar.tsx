'use client';
import { CircleCheck, Bell, Clock, TriangleAlert, CircleAlert, Atom, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionTopic, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { useDockLayout } from '@/engine/editor/layout/dock-layout-context';
import { formatTimeOfDay } from '@/engine/core/environment/celestial';
import { AutosaveStatus } from './autosave-status';
const CELL_CLASS = 'flex h-full shrink-0 items-center gap-1.5 pl-3 whitespace-nowrap shadow-[-1px_0_0_0_var(--border),-2px_0_0_0_var(--bevel)]';
function formatElapsedSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}
export function StatusBar() {
    const session = useSessionTopic('log', 'scene', 'project', 'playtest');
    const stats = useViewportStats();
    const [, dock] = useDockLayout();
    const { log, playtest } = session;
    const { sky } = session.scene;
    const physicsStats = playtest.physics?.world.stats ?? null;
    const lastEntry = log.entries.at(-1) ?? null;
    const issues = log.count('warn') + log.count('error');
    const preparing = stats.shadersPending > 0;
    const StatusIcon = preparing ? Loader : lastEntry?.level === 'error' ? CircleAlert : lastEntry?.level === 'warn' ? TriangleAlert : CircleCheck;
    const statusTone = preparing ? 'text-muted-foreground' : lastEntry?.level === 'error' ? 'text-destructive' : lastEntry?.level === 'warn' ? 'text-warning' : 'text-success';
    const message = preparing ? `Preparando o viewport (${stats.shadersTotal - stats.shadersPending} de ${stats.shadersTotal})…` : (lastEntry?.message ?? 'Pronto');
    return (<footer className="flex h-statusbar shrink-0 items-center gap-x-3 overflow-hidden border-t border-border bg-surface-sunken px-2 font-mono text-3xs text-muted-foreground shadow-[inset_0_1px_0_0_var(--bevel)]">
      <span className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-foreground" title={message} aria-live="polite">
        <StatusIcon className={cn('size-3 shrink-0', statusTone, preparing && 'animate-spin [animation-duration:1.6s]')} aria-hidden/>
        <span className="truncate">{message}</span>
      </span>

      {stats.softwareRenderer && (<span role="alert" className="flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap text-warning" title="O navegador está desenhando sem a placa de vídeo: o desempenho fica muito reduzido. Ative a aceleração de hardware nas configurações do navegador ou atualize o driver de vídeo.">
          <TriangleAlert className="size-3 shrink-0" aria-hidden/>
          Sem aceleração gráfica
        </span>)}

      <span className="ml-auto flex h-full shrink-0 items-center">
        <AutosaveStatus />
      </span>
      <span className={CELL_CLASS} title={sky.cycleSpeed > 0 ? 'Hora do céu (ciclo em andamento)' : 'Hora do céu'}>
        <Clock className="size-3 shrink-0" aria-hidden/>
        {formatTimeOfDay(sky.timeOfDay)}
        {sky.cycleSpeed > 0 && <span className="text-primary">▸</span>}
      </span>
      {playtest.isRunning && (<span className={cn(CELL_CLASS, playtest.state === 'playing' ? 'text-success' : 'text-warning')} title={physicsStats ? 'Simulação: tempo decorrido · corpos em movimento / total · pontos de contato' : 'Simulação: tempo decorrido'}>
          <Atom className={cn('size-3 shrink-0', playtest.state === 'playing' && 'animate-pulse')} aria-hidden/>
          <span className="tabular-nums">{formatElapsedSeconds(playtest.elapsedSeconds)}</span>
          {playtest.timeScale !== 1 && <span>{playtest.timeScale.toFixed(1)}×</span>}
          {physicsStats && (<span className="text-foreground/70">
              {physicsStats.awake}/{physicsStats.bodies} corpos · {physicsStats.contactPoints} contatos
            </span>)}
        </span>)}
      <span className={cn(CELL_CLASS, 'min-w-16 justify-end tabular-nums')} title={stats.idle ? 'Viewport em espera: nada mudou, então ele não redesenha até a próxima ação.' : 'Quadros por segundo do viewport'}>
        {stats.idle ? 'em espera' : `${stats.fps} fps`}
      </span>
      <button type="button" onClick={() => dock.reveal('console')} className={cn(CELL_CLASS, 'pr-0.5 transition-colors hover:text-foreground', issues > 0 && 'text-warning')} title={issues > 0 ? `${issues} ${issues === 1 ? 'aviso ou erro' : 'avisos e erros'} · abrir o console` : 'Nenhum aviso · abrir o console'}>
        <Bell className="size-3" aria-hidden/>
        {issues}
      </button>
    </footer>);
}
