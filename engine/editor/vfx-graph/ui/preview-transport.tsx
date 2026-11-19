'use client';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { useVfxGraph } from './use-vfx-graph';
type PreviewTransportProps = {
    liveParticles: number;
};
const COUNT_FORMAT = new Intl.NumberFormat('pt-BR');
export function PreviewTransport({ liveParticles }: PreviewTransportProps) {
    const editor = useVfxGraph();
    return (<div className="flex h-panelbar shrink-0 items-center gap-0.5 border-t border-border px-1.5">
      <IconButton label={editor.playing ? 'Pausar a simulação' : 'Retomar a simulação'} size="sm" onClick={() => editor.togglePlaying()}>
        {editor.playing ? <Pause aria-hidden/> : <Play aria-hidden/>}
      </IconButton>
      <IconButton label="Reiniciar o efeito do começo" size="sm" onClick={() => editor.restart()}>
        <RotateCcw aria-hidden/>
      </IconButton>
      <span className="ml-auto font-mono text-3xs text-muted-foreground tabular-nums">
        {COUNT_FORMAT.format(liveParticles)} {liveParticles === 1 ? 'partícula' : 'partículas'}
      </span>
    </div>);
}
