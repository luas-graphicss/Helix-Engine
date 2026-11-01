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
}
