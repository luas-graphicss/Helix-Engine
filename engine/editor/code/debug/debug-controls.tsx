'use client';
import { CircleAlert, OctagonPause, Pause, Play, StepForward } from 'lucide-react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { cn } from '@/lib/utils';
import { useDebuggerActions, useDebuggerSelector } from './use-script-debugger';
export function DebugControls({ className }: {
    className?: string;
}) {
    const session = useSessionTopic('playtest');
    const scriptDebugger = useDebuggerActions();
    const paused = useDebuggerSelector((d) => d.paused);
    const breakpointsEnabled = useDebuggerSelector((d) => d.breakpointsEnabled);
    const pauseOnError = useDebuggerSelector((d) => d.pauseOnError);
    const breakpointCount = useDebuggerSelector((d) => d.breakpoints.length);
    const { playtest, scripts } = session;
    const inGame = playtest.state !== 'stopped' && scripts.mode === 'play';
    return (<span className={cn('flex items-center gap-0.5', className)}>
      {inGame && (<>
          {playtest.state === 'paused' ? (<IconButton label={paused ? 'Continuar (sai do ponto de interrupção)' : 'Continuar o jogo'} size="sm" className="[&_svg]:text-axis-y" onClick={() => scriptDebugger.resume()}>
              <Play />
            </IconButton>) : (<IconButton label="Pausar o jogo" size="sm" onClick={() => scriptDebugger.pauseGame()}>
              <Pause />
            </IconButton>)}
          <IconButton label="Avançar um frame" size="sm" onClick={() => scriptDebugger.stepFrame()}>
            <StepForward />
          </IconButton>
          <ToolbarSeparator />
        </>)}
      <IconButton label={breakpointsEnabled ? `Pontos de interrupção ligados${breakpointCount > 0 ? ` (${breakpointCount})` : ''}: clique para desligar todos sem removê-los` : 'Pontos de interrupção desligados: clique para religar'} size="sm" active={breakpointsEnabled && breakpointCount > 0} className={cn(!breakpointsEnabled && 'text-muted-foreground/60')} onClick={() => scriptDebugger.setBreakpointsEnabled(!breakpointsEnabled)}>
        <OctagonPause />
      </IconButton>
      <IconButton label={pauseOnError ? 'Pausar em erro: ligado. O jogo para na linha de qualquer erro não tratado' : 'Pausar em erro: desligado'} size="sm" active={pauseOnError} onClick={() => scriptDebugger.setPauseOnError(!pauseOnError)}>
        <CircleAlert />
      </IconButton>
    </span>);
}
