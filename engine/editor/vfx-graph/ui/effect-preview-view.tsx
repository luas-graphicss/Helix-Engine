'use client';
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { EffectPreviewRenderer } from '../preview/effect-preview-renderer';
import { PreviewTransport } from './preview-transport';
const ORBIT_DEGREES_PER_PIXEL = 0.6;
const ZOOM_SPEED = 0.0015;
const COUNT_REFRESH_MS = 250;
export function EffectPreviewView() {
    const { vfxGraph } = useEditorSession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<EffectPreviewRenderer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [liveParticles, setLiveParticles] = useState(0);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let renderer: EffectPreviewRenderer;
        try {
            renderer = new EffectPreviewRenderer(canvas);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
            return;
        }
        rendererRef.current = renderer;
        let shownError: string | null = null;
        let appliedRestart = vfxGraph.restartCount;
        let countedAt = 0;
        let frame = requestAnimationFrame(function draw(time) {
            frame = requestAnimationFrame(draw);
            const { compiled } = vfxGraph;
            if (!compiled || document.hidden)
                return;
            if (vfxGraph.restartCount !== appliedRestart) {
                appliedRestart = vfxGraph.restartCount;
                renderer.restart();
            }
            renderer.render(compiled, time, vfxGraph.playing);
            if (renderer.error !== shownError) {
                shownError = renderer.error;
                setError(shownError);
            }
            if (time - countedAt >= COUNT_REFRESH_MS) {
                countedAt = time;
                setLiveParticles(renderer.liveParticles);
            }
        });
        return () => {
            cancelAnimationFrame(frame);
            renderer.dispose();
            rendererRef.current = null;
        };
    }, [vfxGraph]);
    const orbit = (event: PointerEvent<HTMLCanvasElement>) => {
        if (event.buttons === 0)
            return;
        rendererRef.current?.orbit(-event.movementX * ORBIT_DEGREES_PER_PIXEL, event.movementY * ORBIT_DEGREES_PER_PIXEL);
    };
    const zoom = (event: WheelEvent<HTMLCanvasElement>) => rendererRef.current?.zoom(Math.exp(event.deltaY * ZOOM_SPEED));
    return (<section aria-label="Pré-visualização do efeito" className="flex shrink-0 flex-col">
      <div className="relative aspect-square w-full bg-surface-sunken">
        <canvas ref={canvasRef} aria-label="Pré-visualização do efeito: arraste para girar, role para aproximar" className="size-full cursor-grab touch-none active:cursor-grabbing" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={orbit} onWheel={zoom}/>
        {error && (<p role="alert" className="absolute inset-x-0 bottom-0 max-h-1/2 overflow-y-auto border-t border-destructive/40 bg-surface-overlay/95 p-2 font-mono text-3xs leading-relaxed whitespace-pre-wrap text-destructive">
            {error}
          </p>)}
      </div>
      <PreviewTransport liveParticles={liveParticles}/>
    </section>);
}
