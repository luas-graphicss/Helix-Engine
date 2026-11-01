'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import { prepareCanvas, readCanvasTheme } from '@/engine/editor/animation/ui/canvas-theme';
import { useElementSize } from '@/engine/ui/use-element-size';
import { seekVfxStage } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useVfxEditor, useVfxStage } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { emitterWindow, VFX_ROW_HEIGHT, VFX_RULER_HEIGHT, vfxTimeToX, vfxXToTime, type VfxStackRow } from '@/engine/editor/vfx/ui/vfx-stack-model';
import { drawVfxGrid, drawVfxLanes, drawVfxPlayhead, drawVfxRuler } from '@/engine/editor/vfx/ui/vfx-timeline-draw';
type VfxTimelineCanvasProps = {
    rows: readonly VfxStackRow[];
    scrollTop: number;
    onWheelScroll: (deltaY: number) => void;
};
export function VfxTimelineCanvas({ rows, scrollTop, onWheelScroll }: VfxTimelineCanvasProps) {
    const session = useEditorSession();
    const editor = useVfxEditor();
    const stage = useVfxStage();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scrubbingRef = useRef(false);
    const size = useElementSize(containerRef);
    const { document } = editor;
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !document || size.width === 0 || size.height === 0)
            return;
        const ctx = prepareCanvas(canvas, size.width, size.height);
        if (!ctx)
            return;
        const theme = readCanvasTheme(canvas);
        const { width, height } = size;
        ctx.fillStyle = theme.surfaceSunken;
        ctx.fillRect(0, 0, width, height);
        drawVfxGrid(ctx, theme, width, VFX_RULER_HEIGHT, height, document);
        drawVfxLanes(ctx, theme, width, rows, document, scrollTop, height);
        drawVfxRuler(ctx, theme, width, document);
        const time = stage.instance?.time ?? 0;
        drawVfxPlayhead(ctx, theme, vfxTimeToX(time, document.duration, width), height, time);
    }, [document, rows, scrollTop, size, stage.instance]);
    useLayoutEffect(draw, [draw]);
    useEffect(() => {
        if (!stage.running)
            return;
        let handle = 0;
        const loop = () => {
            draw();
            handle = requestAnimationFrame(loop);
        };
        handle = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(handle);
    }, [stage.running, draw]);
    const timeAt = (clientX: number): number => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !document)
            return 0;
        const time = vfxXToTime(clientX - rect.left, document.duration, size.width);
        return Math.min(Math.max(0, time), Math.max(0, document.duration - 1e-3));
    };
    const rowAt = (clientY: number): VfxStackRow | null => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect)
            return null;
        const index = Math.floor((clientY - rect.top - VFX_RULER_HEIGHT + scrollTop) / VFX_ROW_HEIGHT);
        return index >= 0 && index < rows.length ? rows[index] : null;
    };
    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !document)
            return;
        const row = rowAt(event.clientY);
        const time = timeAt(event.clientX);
        if (row) {
            const window = emitterWindow(row.emitter, document);
            if (time >= window.start && time <= window.end) {
                if (row.kind === 'emitter')
                    editor.selectEmitter(row.id);
                else
                    editor.selectModule(row.emitter.id, row.id);
            }
        }
        scrubbingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        seekVfxStage(session, time);
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!scrubbingRef.current)
            return;
        seekVfxStage(session, timeAt(event.clientX));
    };
    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!scrubbingRef.current)
            return;
        scrubbingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent<HTMLDivElement>) => {
        if (event.deltaY !== 0)
            onWheelScroll(event.deltaY);
    };
    return (<div ref={containerRef} className="relative h-full w-full cursor-crosshair touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} role="slider" aria-label="Linha do tempo do efeito" aria-valuemin={0} aria-valuemax={document?.duration ?? 0} aria-valuenow={stage.instance?.time ?? 0} tabIndex={-1}>
      <canvas ref={canvasRef} className="block h-full w-full"/>
    </div>);
}
