'use client';
import { Pause, Play, Square, StepForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
export function PlaytestControls() {
    const session = useEditorState();
    const { playtest } = session;
    const playing = playtest.state === 'playing';
    const running = playtest.isRunning;
    return (<div role="group" aria-label="Controles de simulação" className={cn('flex items-center gap-0.5 rounded-sm p-0.5 transition-colors', running ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-sunken')}>
      <IconButton label={playing ? 'Pausar simulação (Ctrl+P)' : 'Simular (Ctrl+P)'} active={playing} onClick={() => playtest.togglePlayPause()}>
        {playing ? <Pause /> : <Play />}
      </IconButton>
      <IconButton label="Avançar um passo fixo" onClick={() => playtest.stepOnce()}>
        <StepForward />
      </IconButton>
      <IconButton label="Parar e restaurar a cena (Ctrl+Shift+P)" disabled={!running} onClick={() => playtest.stop()}>
        <Square />
      </IconButton>
    </div>);
}
