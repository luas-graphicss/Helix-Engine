'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { createPeakColumns, samplePeakColumns, type PeakColumns } from '@/engine/audio/analysis/waveform-peaks';
import { MIN_REGION_SECONDS, type ClipRegion } from '@/engine/audio/clip/audio-clip-settings';
import { clamp, formatClipTime } from '@/engine/audio/core/decibels';
import { fadeGainAt } from '@/engine/audio/graph/fade-curves';
import { CANVAS_FONT, prepareCanvas, readCanvasTheme, type CanvasTheme } from '@/engine/editor/animation/ui/canvas-theme';
import { useCanvasLayer } from '@/engine/ui/use-canvas-layer';
import { useElementSize } from '@/engine/ui/use-element-size';
import type { AudioViewRange } from '@/engine/editor/audio/audio-editor';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { patchAudioClip } from '@/engine/editor/operations/audio-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
const RULER_HEIGHT = 16;
const LOOP_LANE_HEIGHT = 7;
const HANDLE_HIT_PX = 6;
const MIN_TICK_SPACING_PX = 72;
const TICK_STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const ZOOM_WHEEL_FACTOR = 1.2;
const LEVEL_GUIDES = [0.5, 0.25, 0.0625];
type Handle = 'trim-start' | 'trim-end' | 'loop-start' | 'loop-end';
type DragKind = Handle | 'seek';
interface Drag {
    readonly kind: DragKind;
    readonly pointerId: number;
}
const CURSOR_FOR: Record<DragKind, string> = {
    seek: 'text',
    'trim-start': 'ew-resize',
    'trim-end': 'ew-resize',
    'loop-start': 'ew-resize',
    'loop-end': 'ew-resize',
};
function timeToX(time: number, range: AudioViewRange, width: number): number {
    return ((time - range.start) / (range.end - range.start)) * width;
}
function xToTime(x: number, range: AudioViewRange, width: number): number {
    return range.start + (x / width) * (range.end - range.start);
}
function tickStep(range: AudioViewRange, width: number): number {
    const pxPerSecond = width / (range.end - range.start);
    return TICK_STEPS.find((step) => step * pxPerSecond >= MIN_TICK_SPACING_PX) ?? TICK_STEPS[TICK_STEPS.length - 1];
}
function tickLabel(time: number, step: number): string {
    return step < 0.01 ? `${Math.round(time * 1000)} ms` : formatClipTime(time);
}
function drawRuler(ctx: CanvasRenderingContext2D, theme: CanvasTheme, width: number, height: number, range: AudioViewRange): void {
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    ctx.fillStyle = theme.borderStrong;
    ctx.fillRect(0, RULER_HEIGHT - 1, width, 1);
    const step = tickStep(range, width);
    const minor = step / (step / TICK_STEPS[Math.max(0, TICK_STEPS.indexOf(step) - 1)] >= 4 ? 4 : 2);
    const first = Math.floor(range.start / minor) * minor;
    ctx.font = CANVAS_FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (let time = first; time <= range.end + minor; time += minor) {
        const x = Math.round(timeToX(time, range, width)) + 0.5;
        if (x < -1 || x > width + 1)
            continue;
        const major = Math.abs(time / step - Math.round(time / step)) < 1e-6;
        ctx.fillStyle = major ? theme.muted : theme.borderStrong;
        ctx.fillRect(x - 0.5, major ? RULER_HEIGHT - 7 : RULER_HEIGHT - 4, 1, major ? 6 : 3);
        if (major) {
            ctx.fillStyle = theme.muted;
            ctx.fillText(tickLabel(Math.max(0, time), step), x + 3, RULER_HEIGHT / 2 - 1);
        }
        if (major) {
            ctx.fillStyle = theme.borderStrong;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(x - 0.5, RULER_HEIGHT, 1, height - RULER_HEIGHT);
            ctx.globalAlpha = 1;
        }
    }
}
function drawHandleTab(ctx: CanvasRenderingContext2D, x: number, inward: 1 | -1, color: string, emphasized: boolean): void {
    ctx.fillStyle = color;
    ctx.fillRect(x - (emphasized ? 1 : 0.5), RULER_HEIGHT, emphasized ? 2 : 1, 10000);
    ctx.beginPath();
    ctx.moveTo(x, RULER_HEIGHT - 1);
    ctx.lineTo(x + inward * 6, RULER_HEIGHT - 1);
    ctx.lineTo(x, RULER_HEIGHT - 7);
    ctx.closePath();
    ctx.fill();
}
export function WaveformCanvas() {
    const session = useEditorSession();
    const editor = useAudioEditor();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const size = useElementSize(containerRef);
    const columnsRef = useRef<PeakColumns | null>(null);
    const dragRef = useRef<Drag | null>(null);
    const hoverRef = useRef<DragKind | null>(null);
    const range = editor.visibleRange;
    const { peaks, buffer, settings, region, loopRange: loop, duration, bypass } = editor;
    const localX = (event: ReactPointerEvent): {
        x: number;
        y: number;
    } => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const hitAt = (x: number, y: number): Handle | null => {
        if (!region)
            return null;
        const inLoopLane = loop !== null && settings?.loop === true && y >= RULER_HEIGHT && y < RULER_HEIGHT + LOOP_LANE_HEIGHT;
        const candidates: Array<[
            Handle,
            number
        ]> = [];
        if (inLoopLane && loop)
            candidates.push(['loop-start', loop.start], ['loop-end', loop.end]);
        candidates.push(['trim-start', region.start], ['trim-end', region.end]);
        let best: Handle | null = null;
        let bestDistance = HANDLE_HIT_PX;
        for (const [handle, time] of candidates) {
            const distance = Math.abs(timeToX(time, range, size.width) - x);
            if (distance <= bestDistance) {
                bestDistance = distance;
                best = handle;
            }
        }
        return best;
    };
    const applyDrag = (kind: DragKind, x: number) => {
        const asset = editor.asset;
        const current = editor.region;
        if (!asset || !current || duration <= 0)
            return;
        const time = clamp(xToTime(x, range, size.width), 0, duration);
        switch (kind) {
            case 'seek':
                editor.seek(time);
                break;
            case 'trim-start':
                patchAudioClip(session, asset, { trimStart: Math.min(time, current.end - MIN_REGION_SECONDS) }, `Início do recorte de ${asset.name}`, `clip:${asset.id}:trimStart`);
                break;
            case 'trim-end': {
                const end = Math.max(time, current.start + MIN_REGION_SECONDS);
                patchAudioClip(session, asset, { trimEnd: end >= duration - 1e-3 ? null : end }, `Fim do recorte de ${asset.name}`, `clip:${asset.id}:trimEnd`);
                break;
            }
            case 'loop-start': {
                const currentLoop = editor.loopRange;
                if (currentLoop)
                    patchAudioClip(session, asset, { loopStart: clamp(time, current.start, currentLoop.end - MIN_REGION_SECONDS) }, `Início do laço de ${asset.name}`, `clip:${asset.id}:loopStart`);
                break;
            }
            case 'loop-end': {
                const currentLoop = editor.loopRange;
                if (currentLoop)
                    patchAudioClip(session, asset, { loopEnd: clamp(time, currentLoop.start + MIN_REGION_SECONDS, current.end) }, `Fim do laço de ${asset.name}`, `clip:${asset.id}:loopEnd`);
                break;
            }
        }
    };
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || size.width === 0 || size.height === 0)
            return;
        const ctx = prepareCanvas(canvas, size.width, size.height);
        if (!ctx)
            return;
        const theme = readCanvasTheme(canvas);
        const { width, height } = size;
        ctx.fillStyle = theme.surfaceSunken;
        ctx.fillRect(0, 0, width, height);
        const looping = settings?.loop === true && loop !== null;
        const bodyTop = RULER_HEIGHT + (looping ? LOOP_LANE_HEIGHT : 0);
        const bodyHeight = Math.max(1, height - bodyTop);
        const centerY = bodyTop + bodyHeight / 2;
        const amplitude = Math.max(1, bodyHeight / 2 - 2);
        if (region) {
            const startX = timeToX(region.start, range, width);
            const endX = timeToX(region.end, range, width);
            ctx.fillStyle = theme.border;
            ctx.globalAlpha = 0.55;
            if (startX > 0)
                ctx.fillRect(0, RULER_HEIGHT, Math.min(width, startX), height - RULER_HEIGHT);
            if (endX < width)
                ctx.fillRect(Math.max(0, endX), RULER_HEIGHT, width - Math.max(0, endX), height - RULER_HEIGHT);
            ctx.globalAlpha = 1;
        }
        if (looping && loop) {
            const a = Math.max(0, timeToX(loop.start, range, width));
            const b = Math.min(width, timeToX(loop.end, range, width));
            ctx.fillStyle = theme.primary;
            ctx.globalAlpha = 0.07;
            ctx.fillRect(a, bodyTop, Math.max(0, b - a), bodyHeight);
            ctx.globalAlpha = 0.45;
            ctx.fillRect(a, RULER_HEIGHT, Math.max(0, b - a), LOOP_LANE_HEIGHT - 1);
            ctx.globalAlpha = 1;
            ctx.fillStyle = theme.borderStrong;
            ctx.fillRect(0, RULER_HEIGHT + LOOP_LANE_HEIGHT - 1, width, 1);
        }
        ctx.fillStyle = theme.borderStrong;
        for (const guide of LEVEL_GUIDES) {
            ctx.globalAlpha = 0.5;
            ctx.fillRect(0, Math.round(centerY - amplitude * guide), width, 1);
            ctx.fillRect(0, Math.round(centerY + amplitude * guide), width, 1);
        }
        ctx.globalAlpha = 1;
        ctx.fillRect(0, Math.round(centerY), width, 1);
        if (peaks) {
            const columns = columnsRef.current && columnsRef.current.min.length === Math.ceil(width) ? columnsRef.current : createPeakColumns(Math.ceil(width));
            columnsRef.current = columns;
            samplePeakColumns(peaks, buffer, range.start, range.end, columns);
            const secondsPerColumn = (range.end - range.start) / columns.min.length;
            for (let column = 0; column < columns.min.length; column++) {
                const time = range.start + (column + 0.5) * secondsPerColumn;
                const inside = region !== null && time >= region.start && time <= region.end;
                const gain = inside && region && settings && !bypass ? fadeGainAt(settings, region, time) : 1;
                let top = centerY - columns.max[column] * amplitude * gain;
                let bottom = centerY - columns.min[column] * amplitude * gain;
                if (bottom - top < 1) {
                    top = centerY - 0.5;
                    bottom = centerY + 0.5;
                }
                ctx.fillStyle = inside ? theme.primary : theme.muted;
                ctx.globalAlpha = inside ? 0.9 : 0.35;
                ctx.fillRect(column, top, 1, bottom - top);
            }
            ctx.globalAlpha = 1;
        }
        else if (editor.loading) {
            ctx.font = CANVAS_FONT;
            ctx.fillStyle = theme.muted;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Decodificando…', width / 2, centerY);
        }
        if (region && settings && !bypass) {
            const drawFade = (from: number, to: number) => {
                if (to <= from)
                    return;
                const x0 = timeToX(from, range, width);
                const x1 = timeToX(to, range, width);
                if (x1 < 0 || x0 > width)
                    return;
                ctx.strokeStyle = theme.warning;
                ctx.lineWidth = 1;
                ctx.beginPath();
                const steps = Math.max(2, Math.min(200, Math.ceil(x1 - x0)));
                for (let i = 0; i <= steps; i++) {
                    const time = from + ((to - from) * i) / steps;
                    const gain = fadeGainAt(settings, region, time);
                    const x = timeToX(time, range, width);
                    const y = bodyTop + 1 + (1 - gain) * (bodyHeight - 2);
                    if (i === 0)
                        ctx.moveTo(x, y);
                    else
                        ctx.lineTo(x, y);
                }
                ctx.stroke();
            };
            if (settings.fadeIn.duration > 0)
                drawFade(region.start, Math.min(region.end, region.start + settings.fadeIn.duration));
            if (!settings.loop && settings.fadeOut.duration > 0)
                drawFade(Math.max(region.start, region.end - settings.fadeOut.duration), region.end);
        }
        const hover = dragRef.current?.kind ?? hoverRef.current;
        if (region) {
            const startX = Math.round(timeToX(region.start, range, width)) + 0.5;
            const endX = Math.round(timeToX(region.end, range, width)) - 0.5;
            if (startX > -8 && startX < width + 8)
                drawHandleTab(ctx, startX, 1, theme.foreground, hover === 'trim-start');
            if (endX > -8 && endX < width + 8)
                drawHandleTab(ctx, endX, -1, theme.foreground, hover === 'trim-end');
        }
        if (looping && loop) {
            for (const [handle, time, inward] of [
                ['loop-start', loop.start, 1],
                ['loop-end', loop.end, -1],
            ] as const) {
                const x = timeToX(time, range, width);
                if (x < -4 || x > width + 4)
                    continue;
                ctx.fillStyle = hover === handle ? theme.foreground : theme.primary;
                ctx.fillRect(x - (inward === 1 ? 0 : 3), RULER_HEIGHT, 3, LOOP_LANE_HEIGHT - 1);
            }
        }
        drawRuler(ctx, theme, width, height, range);
    }, [size, range, peaks, buffer, settings, region, loop, bypass, editor.loading]);
    useLayoutEffect(draw, [draw]);
    const cursorSubscribes = useMemo(() => [editor.subscribeTime, editor.subscribe], [editor]);
    useCanvasLayer(overlayRef, size, cursorSubscribes, (ctx, theme, width, height) => {
        const cursorX = Math.round(timeToX(editor.position, range, width)) + 0.5;
        if (cursorX < 0 || cursorX > width)
            return;
        ctx.fillStyle = theme.warning;
        ctx.fillRect(cursorX - 0.5, 0, 1, height);
        ctx.beginPath();
        ctx.moveTo(cursorX - 4, 0);
        ctx.lineTo(cursorX + 4, 0);
        ctx.lineTo(cursorX, 6);
        ctx.closePath();
        ctx.fill();
    });
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const onWheel = (event: WheelEvent) => {
            if (editor.duration <= 0 || size.width === 0)
                return;
            event.preventDefault();
            const current = editor.visibleRange;
            const span = current.end - current.start;
            if (event.ctrlKey || event.metaKey) {
                const rect = canvas.getBoundingClientRect();
                const anchor = xToTime(event.clientX - rect.left, current, size.width);
                const factor = event.deltaY > 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR;
                const nextSpan = span * factor;
                const start = anchor - (anchor - current.start) * (nextSpan / span);
                editor.setZoom({ start, end: start + nextSpan });
                return;
            }
            if (!editor.zoom)
                return;
            const delta = (event.deltaX !== 0 ? event.deltaX : event.deltaY) * (span / size.width);
            editor.setZoom({ start: current.start + delta, end: current.end + delta });
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, [editor, size.width]);
    const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0 || !region)
            return;
        const { x, y } = localX(event);
        const kind: DragKind = hitAt(x, y) ?? 'seek';
        dragRef.current = { kind, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        applyDrag(kind, x);
        draw();
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const { x, y } = localX(event);
        const drag = dragRef.current;
        if (drag && drag.pointerId === event.pointerId) {
            applyDrag(drag.kind, x);
            return;
        }
        const hit = hitAt(x, y);
        const next: DragKind | null = hit ?? (y >= RULER_HEIGHT || region ? 'seek' : null);
        if (next !== hoverRef.current) {
            hoverRef.current = next;
            event.currentTarget.style.cursor = next ? CURSOR_FOR[next] : 'default';
            draw();
        }
    };
    const endDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        if (drag.kind !== 'seek')
            session.history.endMerge();
        draw();
    };
    const onPointerLeave = () => {
        if (dragRef.current)
            return;
        hoverRef.current = null;
        draw();
    };
    const regionLabel = (value: ClipRegion | null) => (value ? `${formatClipTime(value.start)} a ${formatClipTime(value.end)}` : '');
    return (<div ref={containerRef} className="relative h-full min-h-0 w-full overflow-hidden">
      <canvas ref={canvasRef} role="img" aria-label={region ? `Forma de onda; recorte de ${regionLabel(region)}` : 'Forma de onda'} className="absolute inset-0 block size-full touch-none select-none" style={{ width: size.width, height: size.height }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={onPointerLeave} onDoubleClick={() => editor.setZoom(null)}/>
      <canvas ref={overlayRef} aria-hidden className="pointer-events-none absolute inset-0 block size-full" style={{ width: size.width, height: size.height }}/>
      {editor.error && (<div role="alert" className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-surface/80 px-2 py-1 text-center text-2xs text-destructive">
          {editor.error}
        </div>)}
    </div>);
}
