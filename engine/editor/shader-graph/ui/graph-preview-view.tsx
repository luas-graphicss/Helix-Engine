'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { GraphPreviewRenderer } from '../preview/graph-preview-renderer';
const ORBIT_DEGREES_PER_PIXEL = 0.6;
export function GraphPreviewView() {
    const { shaderGraph } = useEditorSession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<GraphPreviewRenderer | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let renderer: GraphPreviewRenderer;
        try {
            renderer = new GraphPreviewRenderer(canvas);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
            return;
        }
        rendererRef.current = renderer;
        let shownError: string | null = null;
        let frame = requestAnimationFrame(function draw(time) {
            frame = requestAnimationFrame(draw);
            const { compiled, textures } = shaderGraph;
            if (!compiled || document.hidden)
                return;
            renderer.render(compiled, (assetId, colorSpace) => textures.resolve(assetId, colorSpace), time);
            if (renderer.error !== shownError) {
                shownError = renderer.error;
                setError(shownError);
            }
        });
        return () => {
            cancelAnimationFrame(frame);
            renderer.dispose();
            rendererRef.current = null;
        };
    }, [shaderGraph]);
    const orbit = (event: PointerEvent<HTMLCanvasElement>) => {
        if (event.buttons === 0)
            return;
        rendererRef.current?.orbit(-event.movementX * ORBIT_DEGREES_PER_PIXEL, event.movementY * ORBIT_DEGREES_PER_PIXEL);
    };
    return (<div className="relative aspect-square w-full shrink-0 bg-surface-sunken">
      <canvas ref={canvasRef} aria-label="Pré-visualização do shader: arraste para girar" className="size-full cursor-grab touch-none active:cursor-grabbing" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={orbit}/>
      {error && (<p role="alert" className="absolute inset-x-0 bottom-0 max-h-1/2 overflow-y-auto border-t border-destructive/40 bg-surface-overlay/95 p-2 font-mono text-3xs leading-relaxed whitespace-pre-wrap text-destructive">
          {error}
        </p>)}
    </div>);
}
