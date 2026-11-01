'use client';
import { Pause, Play, Square, StepForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
export function PlaytestControls() {
    const session = useSessionTopic('playtest', 'scene');
    const hint = useShortcutHint();
    const { playtest } = session;
    const playing = playtest.state === 'playing';
    const running = playtest.isRunning;
    return (<div role="group" aria-label="Controles de simulação" className={cn('flex h-6 items-center gap-px rounded-sm p-px transition-colors duration-150', WELL_CLASS, running && (playing ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'))}>
      <IconButton label={hint(playing ? 'Pausar simulação' : running ? 'Continuar simulação' : 'Simular física', 'simulation.playPause')} size="sm" active={playing} onClick={() => playtest.togglePlayPause()} className={cn('[&_svg]:size-4', playing ? 'bg-success/15 text-success ring-success/40 hover:bg-success/25 hover:text-success' : 'text-success hover:text-success')}>
        {playing ? <Pause /> : <Play className="fill-current"/>}
      </IconButton>
      <IconButton label="Avançar um passo da simulação" size="sm" onClick={() => playtest.stepOnce()} className="[&_svg]:size-4">
        <StepForward />
      </IconButton>
      <IconButton label={hint('Parar e restaurar a cena', 'simulation.stop')} size="sm" disabled={!running} onClick={() => playtest.stop()} className="hover:text-destructive [&_svg]:size-4">
        <Square className={cn(running && 'fill-current')}/>
      </IconButton>
    </div>);
}
