'use client';
import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { ANIMATION_PATHS, type AnimationPath, type AnimationTrack } from '@/engine/core/animation/animation-document';
import { keyIndexAt, trackAt, type KeyRef } from '@/engine/core/animation/track-editing';
import { sampleTrack } from '@/engine/core/animation/track-sampling';
import { CANVAS_FONT, prepareCanvas, readCanvasTheme, type CanvasTheme } from '@/engine/editor/animation/ui/canvas-theme';
import { drawPlayhead, drawRuler, drawTimeGrid, hitTestEvent, niceStep } from '@/engine/editor/animation/ui/timeline-draw';
import { COMPONENT_LABELS, DRAG_THRESHOLD_PX, KEY_HIT_RADIUS, PATH_LABELS, RULER_HEIGHT, displayFromSample, formatDisplayValue, formatFrame, keyDisplayValue, rawValueFromDisplay, timeToX, xToTime, } from '@/engine/editor/animation/ui/timeline-model';
import { useAnimationEditor, useAnimationTime, useElementSize } from '@/engine/editor/animation/ui/use-animation-editor';
type CurveCanvasProps = {
    selectedEvent: number;
    onSelectEvent: (index: number) => void;
};
interface CurveKeyHit {
    readonly index: number;
    readonly component: number;
    readonly time: number;
}
interface ValueRange {
    readonly min: number;
    readonly max: number;
}
type Drag = {
    kind: 'scrub';
} | {
    kind: 'event';
    index: number;
} | {
    kind: 'value';
    ref: KeyRef;
    component: number;
    startY: number;
    started: boolean;
    base: Float32Array;
    range: ValueRange;
};
const PLOT_TOP = RULER_HEIGHT + 10;
const PLOT_BOTTOM = 10;
const LABEL_GUTTER = 44;
const KEY_RADIUS = 3.5;
const SAMPLE_SPACING_PX = 3;
const sampleScratch = new Float32Array(4);
const displayScratch = new Float32Array(3);
function componentColor(theme: CanvasTheme, component: number): string {
    return component === 0 ? theme.axisX : component === 1 ? theme.axisY : theme.axisZ;
}
function availablePaths(document: {
    tracks: readonly AnimationTrack[];
} | null, joint: string | null): AnimationPath[] {
    if (!document || !joint)
        return [];
    return ANIMATION_PATHS.filter((path) => document.tracks.some((track) => track.joint === joint && track.path === path));
}
export function CurveCanvas({ selectedEvent, onSelectEvent }: CurveCanvasProps) {
    const editor = useAnimationEditor();
    const time = useAnimationTime();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = useElementSize(containerRef);
    const dragRef = useRef<Drag | null>(null);
    const hoverRef = useRef<CurveKeyHit | null>(null);
    const rangeRef = useRef<ValueRange>({ min: -1, max: 1 });
    const [preferredPath, setPreferredPath] = useState<AnimationPath>('rotation');
    const [visible, setVisible] = useState<readonly boolean[]>([true, true, true]);
    const joint = editor.selectedBones[0] ?? editor.selectedKeys[0]?.joint ?? null;
    const paths = availablePaths(editor.document, joint);
    const path: AnimationPath | null = paths.includes(preferredPath) ? preferredPath : (paths[0] ?? null);
    const track = editor.document && joint && path ? trackAt(editor.document, joint, path) : undefined;
    const plotHeight = Math.max(1, size.height - PLOT_TOP - PLOT_BOTTOM);
    const valueToY = (value: number, range: ValueRange) => PLOT_TOP + (1 - (value - range.min) / (range.max - range.min)) * plotHeight;
    const computeRange = (current: AnimationTrack): ValueRange => {
        let min = Infinity;
        let max = -Infinity;
        const consider = (value: number) => {
            if (value < min)
                min = value;
            if (value > max)
                max = value;
        };
        const samples = Math.max(2, Math.ceil(size.width / SAMPLE_SPACING_PX));
        for (let i = 0; i <= samples; i++) {
            sampleTrack(current, (i / samples) * editor.duration, sampleScratch);
            displayFromSample(current.path, sampleScratch, displayScratch);
            for (let c = 0; c < 3; c++)
                if (visible[c])
                    consider(displayScratch[c]);
        }
        for (let index = 0; index < current.times.length; index++) {
            keyDisplayValue(current, index, displayScratch);
            for (let c = 0; c < 3; c++)
                if (visible[c])
                    consider(displayScratch[c]);
        }
        if (!Number.isFinite(min) || !Number.isFinite(max))
            return { min: -1, max: 1 };
        if (max - min < 1e-6)
            return { min: min - 1, max: max + 1 };
        const pad = (max - min) * 0.12;
        return { min: min - pad, max: max + pad };
    };
    const keyAt = (x: number, y: number): CurveKeyHit | null => {
        if (!track)
            return null;
        const range = rangeRef.current;
        let best: CurveKeyHit | null = null;
        let bestDistance = KEY_HIT_RADIUS + 1;
        for (let index = 0; index < track.times.length; index++) {
            const keyX = timeToX(track.times[index], editor.duration, size.width);
            if (Math.abs(keyX - x) > KEY_HIT_RADIUS + 1)
                continue;
            keyDisplayValue(track, index, displayScratch);
            for (let c = 0; c < 3; c++) {
                if (!visible[c])
                    continue;
                const distance = Math.hypot(keyX - x, valueToY(displayScratch[c], range) - y);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = { index, component: c, time: track.times[index] };
                }
            }
        }
        return best;
    };
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const { document } = editor;
        if (!canvas || !document || size.width === 0 || size.height === 0)
            return;
        const ctx = prepareCanvas(canvas, size.width, size.height);
        if (!ctx)
            return;
        const theme = readCanvasTheme(canvas);
        const { width, height } = size;
        const { duration, frameRate } = editor;
        ctx.fillStyle = theme.surfaceSunken;
        ctx.fillRect(0, 0, width, height);
        drawTimeGrid(ctx, theme, width, RULER_HEIGHT, height, duration, frameRate);
        if (track) {
            const drag = dragRef.current;
            const range = drag?.kind === 'value' ? drag.range : computeRange(track);
            rangeRef.current = range;
            ctx.font = CANVAS_FONT;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            const step = niceStep(range.max - range.min, 5);
            for (let value = Math.ceil(range.min / step) * step; value <= range.max; value += step) {
                const y = Math.round(valueToY(value, range)) + 0.5;
                ctx.fillStyle = theme.borderStrong;
                ctx.fillRect(LABEL_GUTTER, y - 0.5, width - LABEL_GUTTER, 1);
                ctx.fillStyle = theme.muted;
                ctx.fillText(Math.abs(value) < 1e-9 ? '0' : Number(value.toPrecision(4)).toString(), 4, y);
            }
            const samples = Math.max(2, Math.ceil(width / SAMPLE_SPACING_PX));
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            for (let c = 0; c < 3; c++) {
                if (!visible[c])
                    continue;
                ctx.strokeStyle = componentColor(theme, c);
                ctx.beginPath();
                for (let i = 0; i <= samples; i++) {
                    const t = (i / samples) * duration;
                    sampleTrack(track, t, sampleScratch);
                    displayFromSample(track.path, sampleScratch, displayScratch);
                    const x = timeToX(t, duration, width);
                    const y = valueToY(displayScratch[c], range);
                    if (i === 0)
                        ctx.moveTo(x, y);
                    else
                        ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            const hover = hoverRef.current;
            for (let index = 0; index < track.times.length; index++) {
                const keyTime = track.times[index];
                const x = timeToX(keyTime, duration, width);
                const selected = editor.isKeySelected({ joint: track.joint, path: track.path, time: keyTime });
                keyDisplayValue(track, index, displayScratch);
                for (let c = 0; c < 3; c++) {
                    if (!visible[c])
                        continue;
                    const y = valueToY(displayScratch[c], range);
                    const hovered = hover !== null && hover.index === index && hover.component === c;
                    ctx.beginPath();
                    ctx.arc(x, y, hovered ? KEY_RADIUS + 1 : KEY_RADIUS, 0, Math.PI * 2);
                    ctx.fillStyle = selected ? theme.warning : componentColor(theme, c);
                    ctx.fill();
                    ctx.strokeStyle = hovered ? theme.foreground : theme.surfaceSunken;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            const focus = drag?.kind === 'value' ? { index: keyIndexAt(track.times, drag.ref.time), component: drag.component } : hover;
            if (focus && focus.index !== -1) {
                keyDisplayValue(track, focus.index, displayScratch);
                const label = `${COMPONENT_LABELS[focus.component]} ${formatDisplayValue(track.path, displayScratch[focus.component])} · q ${formatFrame(track.times[focus.index], frameRate)}`;
                const x = timeToX(track.times[focus.index], duration, width);
                const y = valueToY(displayScratch[focus.component], range);
                ctx.font = CANVAS_FONT;
                const textWidth = Math.ceil(ctx.measureText(label).width) + 8;
                const boxX = Math.min(width - textWidth - 2, Math.max(2, x + 8));
                const boxY = Math.max(RULER_HEIGHT + 2, y - 20);
                ctx.fillStyle = theme.surfaceRaised;
                ctx.fillRect(boxX, boxY, textWidth, 14);
                ctx.fillStyle = theme.foreground;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, boxX + 4, boxY + 7);
            }
        }
        else {
            ctx.font = CANVAS_FONT;
            ctx.fillStyle = theme.muted;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(joint ? `${joint} ainda não tem faixas: pose o osso para gravar a primeira chave.` : 'Selecione um osso para ver as curvas dele.', width / 2, RULER_HEIGHT + (height - RULER_HEIGHT) / 2);
        }
        drawRuler(ctx, theme, { width, duration, frameRate, events: document.events, selectedEvent, hoveredEvent: -1 });
        drawPlayhead(ctx, theme, timeToX(editor.time, duration, width), height, formatFrame(editor.time, frameRate));
    }, [editor, track, size, visible, joint, selectedEvent, time]);
    const version = editor.getVersion();
    useLayoutEffect(() => {
        draw();
    }, [draw, version]);
    const localPoint = (event: ReactPointerEvent): {
        x: number;
        y: number;
    } => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const setCursor = (event: ReactPointerEvent, cursor: string) => {
        ;
        (event.currentTarget as HTMLElement).style.cursor = cursor;
    };
    const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0 || !editor.document)
            return;
        const { x, y } = localPoint(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        if (y < RULER_HEIGHT) {
            const eventIndex = hitTestEvent(editor.document.events, x, y, editor.duration, size.width);
            if (eventIndex !== -1) {
                onSelectEvent(eventIndex);
                dragRef.current = { kind: 'event', index: eventIndex };
                return;
            }
            editor.pause();
            editor.setTime(xToTime(x, editor.duration, size.width));
            dragRef.current = { kind: 'scrub' };
            return;
        }
        const hit = track ? keyAt(x, y) : null;
        if (!hit || !track) {
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey)
                editor.selectKeys([], 'replace');
            return;
        }
        const ref: KeyRef = { joint: track.joint, path: track.path, time: hit.time };
        if (event.ctrlKey || event.metaKey)
            editor.selectKeys([ref], 'toggle');
        else if (event.shiftKey)
            editor.selectKeys([ref], 'add');
        else if (!editor.isKeySelected(ref))
            editor.selectKeys([ref], 'replace');
        const base = keyDisplayValue(track, hit.index, new Float32Array(3));
        dragRef.current = { kind: 'value', ref, component: hit.component, startY: y, started: false, base, range: rangeRef.current };
        setCursor(event, 'ns-resize');
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const { x, y } = localPoint(event);
        const drag = dragRef.current;
        if (!drag) {
            const hit = keyAt(x, y);
            const previous = hoverRef.current;
            hoverRef.current = hit;
            setCursor(event, hit ? 'ns-resize' : y < RULER_HEIGHT ? 'col-resize' : '');
            if (previous?.index !== hit?.index || previous?.component !== hit?.component)
                draw();
            return;
        }
        if (drag.kind === 'scrub') {
            editor.setTime(xToTime(x, editor.duration, size.width));
            return;
        }
        if (drag.kind === 'event') {
            editor.updateEvent(drag.index, { time: editor.snapTime(xToTime(x, editor.duration, size.width)) });
            return;
        }
        if (!drag.started) {
            if (Math.abs(y - drag.startY) < DRAG_THRESHOLD_PX)
                return;
            drag.started = true;
        }
        const delta = (-(y - drag.startY) / plotHeight) * (drag.range.max - drag.range.min);
        const display = new Float32Array(drag.base);
        display[drag.component] = drag.base[drag.component] + delta;
        editor.setKeyValue(drag.ref, rawValueFromDisplay(drag.ref.path, display));
    };
    const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!dragRef.current)
            return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        setCursor(event, '');
        draw();
    };
    const onPointerLeave = () => {
        if (dragRef.current)
            return;
        hoverRef.current = null;
        draw();
    };
    return (<div className="flex h-full w-full flex-col">
      <div className="flex h-7 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface px-2 text-2xs [scrollbar-width:none]">
        <span className="shrink-0 truncate font-medium text-foreground">{joint ?? 'Nenhum osso'}</span>
        {paths.length > 0 && <span className="shrink-0 text-muted-foreground/60">·</span>}
        <div role="radiogroup" aria-label="Faixa exibida" className="flex shrink-0 items-center gap-0.5">
          {paths.map((candidate) => (<button key={candidate} type="button" role="radio" aria-checked={candidate === path} onClick={() => setPreferredPath(candidate)} className={cn('h-5 rounded-sm px-1.5 transition-colors', candidate === path ? 'bg-primary/20 font-medium text-primary' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
              {PATH_LABELS[candidate]}
            </button>))}
        </div>
        {track && (<div className="ml-auto flex shrink-0 items-center gap-0.5" role="group" aria-label="Componentes visíveis">
            {COMPONENT_LABELS.map((label, component) => (<button key={label} type="button" aria-pressed={visible[component]} onClick={() => setVisible(visible.map((on, index) => (index === component ? !on : on)))} className={cn('flex h-5 w-6 items-center justify-center rounded-sm font-mono transition-colors', visible[component] ? (component === 0 ? 'bg-axis-x/20 text-axis-x' : component === 1 ? 'bg-axis-y/20 text-axis-y' : 'bg-axis-z/20 text-axis-z') : 'text-muted-foreground/60 hover:bg-highlight')}>
                {label}
              </button>))}
          </div>)}
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} role="img" aria-label="Curvas de animação do osso selecionado" className="block h-full w-full touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerLeave}/>
      </div>
    </div>);
}
