'use client';
import { useCallback, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import type { KeyRef } from '@/engine/core/animation/track-editing';
import type { AnimationEditor } from '@/engine/editor/animation/animation-editor';
import { prepareCanvas, readCanvasTheme } from '@/engine/editor/animation/ui/canvas-theme';
import { drawDiamond, drawPlayhead, drawRuler, drawTimeGrid, hitTestEvent } from '@/engine/editor/animation/ui/timeline-draw';
import { DRAG_THRESHOLD_PX, KEY_HIT_RADIUS, ROW_HEIGHT, RULER_HEIGHT, formatFrame, rowJoint, rowKeyRefs, timeSpan, timeToX, xToTime, type TimelineRow, } from '@/engine/editor/animation/ui/timeline-model';
import { useAnimationEditor, useAnimationTime, useElementSize } from '@/engine/editor/animation/ui/use-animation-editor';
type DopesheetCanvasProps = {
    rows: readonly TimelineRow[];
    scrollTop: number;
    onWheelScroll: (deltaY: number) => void;
    selectedEvent: number;
    onSelectEvent: (index: number) => void;
};
interface KeyHit {
    readonly rowIndex: number;
    readonly time: number;
}
type Drag = {
    kind: 'scrub';
} | {
    kind: 'key';
    startX: number;
    started: boolean;
} | {
    kind: 'marquee';
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    moved: boolean;
    toggle: boolean;
    add: boolean;
} | {
    kind: 'event';
    index: number;
    moved: boolean;
};
interface Modifiers {
    readonly toggle: boolean;
    readonly add: boolean;
}
const BONE_KEY_SIZE = 4.5;
const TRACK_KEY_SIZE = 3.5;
function modifiersOf(event: ReactPointerEvent): Modifiers {
    return { toggle: event.ctrlKey || event.metaKey, add: event.shiftKey };
}
function timeKey(time: number): string {
    return time.toFixed(4);
}
export function DopesheetCanvas({ rows, scrollTop, onWheelScroll, selectedEvent, onSelectEvent }: DopesheetCanvasProps) {
    const editor = useAnimationEditor();
    const time = useAnimationTime();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = useElementSize(containerRef);
    const dragRef = useRef<Drag | null>(null);
    const hoverRef = useRef<KeyHit | null>(null);
    const hoveredEventRef = useRef(-1);
    const localPoint = (event: ReactPointerEvent): {
        x: number;
        y: number;
    } => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const rowIndexAt = (y: number): number => {
        const index = Math.floor((y - RULER_HEIGHT + scrollTop) / ROW_HEIGHT);
        return index >= 0 && index < rows.length ? index : -1;
    };
    const rowTop = (index: number): number => RULER_HEIGHT + index * ROW_HEIGHT - scrollTop;
    const keyAt = (x: number, y: number): KeyHit | null => {
        const rowIndex = rowIndexAt(y);
        if (rowIndex === -1)
            return null;
        const row = rows[rowIndex];
        let best: KeyHit | null = null;
        let bestDistance = KEY_HIT_RADIUS;
        for (const keyTime of row.keyTimes) {
            const distance = Math.abs(timeToX(keyTime, editor.duration, size.width) - x);
            if (distance <= bestDistance) {
                bestDistance = distance;
                best = { rowIndex, time: keyTime };
            }
        }
        return best;
    };
    const refsForHit = (hit: KeyHit): KeyRef[] => (editor.document ? rowKeyRefs(editor.document, rows[hit.rowIndex], hit.time) : []);
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
        const selectedTrackKeys = new Set<string>();
        const selectedBoneKeys = new Set<string>();
        for (const ref of editor.selectedKeys) {
            selectedTrackKeys.add(`${ref.joint}/${ref.path}@${timeKey(ref.time)}`);
            selectedBoneKeys.add(`${ref.joint}@${timeKey(ref.time)}`);
        }
        const hover = hoverRef.current;
        const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));
        const last = Math.min(rows.length - 1, Math.ceil((scrollTop + height - RULER_HEIGHT) / ROW_HEIGHT));
        for (let index = first; index <= last; index++) {
            const row = rows[index];
            const y = rowTop(index);
            if (row.kind === 'bone' && row.selected) {
                ctx.fillStyle = theme.primary;
                ctx.globalAlpha = 0.1;
                ctx.fillRect(0, y, width, ROW_HEIGHT);
                ctx.globalAlpha = 1;
            }
            else if (row.kind === 'track') {
                ctx.fillStyle = theme.highlight;
                ctx.fillRect(0, y, width, ROW_HEIGHT);
            }
            if (hover && hover.rowIndex === index) {
                ctx.fillStyle = theme.highlight;
                ctx.fillRect(0, y, width, ROW_HEIGHT);
            }
            ctx.fillStyle = theme.borderStrong;
            ctx.fillRect(0, y + ROW_HEIGHT - 1, width, 1);
        }
        drawTimeGrid(ctx, theme, width, RULER_HEIGHT, height, duration, frameRate);
        for (let index = first; index <= last; index++) {
            const row = rows[index];
            const centerY = rowTop(index) + ROW_HEIGHT / 2;
            const joint = rowJoint(row);
            const keySize = row.kind === 'bone' ? BONE_KEY_SIZE : TRACK_KEY_SIZE;
            for (const keyTime of row.keyTimes) {
                const x = timeToX(keyTime, duration, width);
                if (x < -keySize || x > width + keySize)
                    continue;
                const selected = row.kind === 'bone' ? selectedBoneKeys.has(`${joint}@${timeKey(keyTime)}`) : selectedTrackKeys.has(`${joint}/${row.path}@${timeKey(keyTime)}`);
                const hovered = hover !== null && hover.rowIndex === index && hover.time === keyTime;
                drawDiamond(ctx, x, centerY, keySize);
                ctx.fillStyle = selected ? theme.warning : row.kind === 'bone' ? theme.foreground : theme.muted;
                ctx.fill();
                if (selected || hovered) {
                    ctx.strokeStyle = hovered ? theme.foreground : theme.surfaceSunken;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
        const drag = dragRef.current;
        if (drag?.kind === 'marquee' && drag.moved) {
            const x = Math.min(drag.x0, drag.x1);
            const y = Math.min(drag.y0, drag.y1);
            const w = Math.abs(drag.x1 - drag.x0);
            const h = Math.abs(drag.y1 - drag.y0);
            ctx.fillStyle = theme.primary;
            ctx.globalAlpha = 0.12;
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = theme.primary;
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
        }
        drawRuler(ctx, theme, { width, duration, frameRate, events: document.events, selectedEvent, hoveredEvent: hoveredEventRef.current });
        drawPlayhead(ctx, theme, timeToX(editor.time, duration, width), height, formatFrame(editor.time, frameRate));
    }, [editor, rows, scrollTop, size, selectedEvent, time]);
    const version = editor.getVersion();
    useLayoutEffect(() => {
        draw();
    }, [draw, version]);
    const setCursor = (event: ReactPointerEvent, cursor: string) => {
        ;
        (event.currentTarget as HTMLElement).style.cursor = cursor;
    };
    const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0 || !editor.document)
            return;
        const { x, y } = localPoint(event);
        const modifiers = modifiersOf(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        if (y < RULER_HEIGHT) {
            const eventIndex = hitTestEvent(editor.document.events, x, y, editor.duration, size.width);
            if (eventIndex !== -1) {
                onSelectEvent(eventIndex);
                dragRef.current = { kind: 'event', index: eventIndex, moved: false };
                return;
            }
            editor.pause();
            editor.setTime(xToTime(x, editor.duration, size.width));
            dragRef.current = { kind: 'scrub' };
            return;
        }
        const hit = keyAt(x, y);
        if (hit) {
            const refs = refsForHit(hit);
            const allSelected = refs.length > 0 && refs.every((ref) => editor.isKeySelected(ref));
            if (modifiers.toggle)
                editor.selectKeys(refs, 'toggle');
            else if (modifiers.add)
                editor.selectKeys(refs, 'add');
            else if (!allSelected)
                editor.selectKeys(refs, 'replace');
            const row = rows[hit.rowIndex];
            if (!editor.selectedBones.includes(rowJoint(row)))
                editor.selectBone(rowJoint(row), 'replace');
            dragRef.current = { kind: 'key', startX: x, started: false };
            setCursor(event, 'grabbing');
            return;
        }
        dragRef.current = { kind: 'marquee', x0: x, y0: y, x1: x, y1: y, moved: false, toggle: modifiers.toggle, add: modifiers.add };
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const { x, y } = localPoint(event);
        const drag = dragRef.current;
        if (!drag) {
            const hit = keyAt(x, y);
            const previous = hoverRef.current;
            hoverRef.current = hit;
            const hoveredEvent = y < RULER_HEIGHT && editor.document ? hitTestEvent(editor.document.events, x, y, editor.duration, size.width) : -1;
            const eventChanged = hoveredEvent !== hoveredEventRef.current;
            hoveredEventRef.current = hoveredEvent;
            const rowIndex = rowIndexAt(y);
            editor.setHoveredBone(rowIndex === -1 ? null : rowJoint(rows[rowIndex]));
            setCursor(event, hit ? 'grab' : hoveredEvent !== -1 ? 'ew-resize' : y < RULER_HEIGHT ? 'col-resize' : '');
            if (eventChanged || previous?.rowIndex !== hit?.rowIndex || previous?.time !== hit?.time)
                draw();
            return;
        }
        switch (drag.kind) {
            case 'scrub':
                editor.setTime(xToTime(x, editor.duration, size.width));
                return;
            case 'event': {
                drag.moved = true;
                editor.updateEvent(drag.index, { time: editor.snapTime(xToTime(x, editor.duration, size.width)) });
                return;
            }
            case 'key': {
                if (!drag.started) {
                    if (Math.abs(x - drag.startX) < DRAG_THRESHOLD_PX)
                        return;
                    drag.started = true;
                    editor.beginKeyDrag();
                }
                editor.updateKeyDrag(((x - drag.startX) / timeSpan(size.width)) * editor.duration);
                return;
            }
            case 'marquee': {
                drag.x1 = x;
                drag.y1 = y;
                if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) >= DRAG_THRESHOLD_PX)
                    drag.moved = true;
                if (drag.moved)
                    draw();
                return;
            }
        }
    };
    const finishMarquee = (drag: Extract<Drag, {
        kind: 'marquee';
    }>) => {
        const { document } = editor;
        if (!document)
            return;
        if (!drag.moved) {
            if (!drag.toggle && !drag.add)
                editor.selectKeys([], 'replace');
            return;
        }
        const left = Math.min(drag.x0, drag.x1);
        const right = Math.max(drag.x0, drag.x1);
        const top = Math.min(drag.y0, drag.y1);
        const bottom = Math.max(drag.y0, drag.y1);
        const startTime = xToTime(left - KEY_HIT_RADIUS, editor.duration, size.width);
        const endTime = xToTime(right + KEY_HIT_RADIUS, editor.duration, size.width);
        const refs: KeyRef[] = [];
        const seen = new Set<string>();
        rows.forEach((row, index) => {
            const y = rowTop(index);
            if (y + ROW_HEIGHT < top || y > bottom)
                return;
            for (const keyTime of row.keyTimes) {
                if (keyTime < startTime || keyTime > endTime)
                    continue;
                for (const ref of rowKeyRefs(document, row, keyTime)) {
                    const key = `${ref.joint}/${ref.path}@${timeKey(ref.time)}`;
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    refs.push(ref);
                }
            }
        });
        editor.selectKeys(refs, drag.toggle ? 'toggle' : drag.add ? 'add' : 'replace');
    };
    const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current;
        if (!drag)
            return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        const cancelled = event.type === 'pointercancel';
        if (drag.kind === 'key' && drag.started)
            editor.endKeyDrag(cancelled);
        else if (drag.kind === 'marquee' && !cancelled)
            finishMarquee(drag);
        setCursor(event, '');
        draw();
    };
    const onPointerLeave = () => {
        if (dragRef.current)
            return;
        hoverRef.current = null;
        hoveredEventRef.current = -1;
        editor.setHoveredBone(null);
        draw();
    };
    const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
        if (event.deltaY !== 0)
            onWheelScroll(event.deltaY);
    };
    return (<div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} role="img" aria-label="Linha do tempo das chaves de animação" className="block h-full w-full touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerLeave} onWheel={onWheel}/>
    </div>);
}
