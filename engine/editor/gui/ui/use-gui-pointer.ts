'use client';
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { GuiElementKind, GuiPoint } from '@/engine/gui/document/gui-document';
import { applyMatrix, matrixInvert } from '@/engine/gui/layout/gui-matrix';
import { addGuiElement, centeredGuiDropPoint, duplicateSelectedGuiNodes, moveGuiNodeTo, setGuiNodeBoxes } from '@/engine/editor/operations/gui-element-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { GuiDesigner } from '../gui-designer';
import { beginMove, beginResize, beginRotate, updateMove, updateResize, updateRotate, type DragModifiers, type MoveSession, type ResizeSession, type RotateSession, type SnapSettings } from '../gui-drag-session';
import { marqueeSelection, pickDropContainer, pickForClick, pickForDoubleClick, selectionFrame, type GuiSelectionFrame } from '../gui-selection';
import { boxBetween, constrainDrawBox, handleCursor, hitHandle, hitRotationZone, type GuiHandle } from './gui-canvas-interaction';
import type { OverlayDragView } from './gui-canvas-overlay';
import { ROTATE_CURSOR } from './gui-cursors';
const DRAG_THRESHOLD = 3;
const SNAP_DISTANCE = 6;
const WHEEL_ZOOM_RATE = 0.0015;
interface Pending {
    readonly phase: 'pending';
    readonly pointerId: number;
    readonly button: number;
    readonly host: GuiPoint;
    readonly doc: GuiPoint;
    readonly hit: {
        readonly kind: 'handle';
        readonly handle: GuiHandle;
    } | {
        readonly kind: 'rotate';
    } | {
        readonly kind: 'element';
        readonly id: string;
        readonly wasSelected: boolean;
    } | {
        readonly kind: 'empty';
    } | {
        readonly kind: 'pan';
    } | {
        readonly kind: 'draw';
        readonly tool: GuiElementKind;
    };
    readonly modifiers: DragModifiers;
}
type DragSession = {
    readonly kind: 'move';
    readonly session: MoveSession;
    readonly ids: readonly string[];
    readonly mergeKey: string;
} | {
    readonly kind: 'resize';
    readonly session: ResizeSession;
    readonly mergeKey: string;
} | {
    readonly kind: 'rotate';
    readonly session: RotateSession;
    readonly mergeKey: string;
} | {
    readonly kind: 'marquee';
    readonly origin: GuiPoint;
    readonly additive: boolean;
} | {
    readonly kind: 'draw';
    readonly origin: GuiPoint;
    readonly tool: GuiElementKind;
} | {
    readonly kind: 'pan';
    lastHost: GuiPoint;
};
interface Dragging {
    readonly phase: 'dragging';
    readonly pointerId: number;
    readonly drag: DragSession;
}
type PointerPhase = {
    readonly phase: 'idle';
} | Pending | Dragging;
export interface GuiPointerHandlers {
    readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    readonly onPointerCancel: () => void;
    readonly onPointerLeave: () => void;
    readonly onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
}
export interface GuiPointerState {
    readonly frame: GuiSelectionFrame | null;
    readonly drag: OverlayDragView | null;
    readonly cursor: string;
    readonly hideHandles: boolean;
    readonly handlers: GuiPointerHandlers;
}
let dragCounter = 0;
function modifiersOf(event: {
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}): DragModifiers {
    return { shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey || event.metaKey };
}
function isTextEntryTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
function hitFrame(frame: GuiSelectionFrame, doc: GuiPoint, zoom: number): Pending['hit'] | null {
    const local = applyMatrix(matrixInvert(frame.world), doc.x, doc.y);
    const handle = hitHandle(frame.box, local, zoom);
    if (handle)
        return { kind: 'handle', handle };
    if (hitRotationZone(frame.box, local, zoom))
        return { kind: 'rotate' };
    return null;
}
export function useGuiPointer(hostRef: RefObject<HTMLDivElement | null>, session: EditorSession, designer: GuiDesigner): GuiPointerState {
    const phaseRef = useRef<PointerPhase>({ phase: 'idle' });
    const [drag, setDrag] = useState<OverlayDragView | null>(null);
    const [hoverCursor, setHoverCursor] = useState<string | null>(null);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const layout = designer.layout();
    const frame = layout && designer.mode === 'design' ? selectionFrame(layout, designer.selectedIds) : null;
    const hostRectRef = useRef<DOMRect | null>(null);
    const toHost = useCallback((event: {
        clientX: number;
        clientY: number;
    }): GuiPoint => {
        const rect = (hostRectRef.current ??= hostRef.current?.getBoundingClientRect() ?? null);
        return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: event.clientX, y: event.clientY };
    }, [hostRef]);
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        const invalidate = () => {
            hostRectRef.current = null;
        };
        const observer = new ResizeObserver(invalidate);
        observer.observe(host);
        host.addEventListener('pointerdown', invalidate, { capture: true });
        host.addEventListener('pointerenter', invalidate);
        window.addEventListener('resize', invalidate);
        window.addEventListener('scroll', invalidate, { capture: true, passive: true });
        return () => {
            observer.disconnect();
            host.removeEventListener('pointerdown', invalidate, { capture: true });
            host.removeEventListener('pointerenter', invalidate);
            window.removeEventListener('resize', invalidate);
            window.removeEventListener('scroll', invalidate, { capture: true });
            invalidate();
        };
    }, [hostRef]);
    const snapSettings = useCallback((): SnapSettings => ({ guides: designer.options.snapGuides, grid: designer.options.snapGrid ? designer.options.gridSize : null, threshold: SNAP_DISTANCE / designer.view.zoom }), [designer]);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === ' ' && !isTextEntryTarget(event.target) && !event.repeat)
                setSpaceHeld(true);
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === ' ')
                setSpaceHeld(false);
        };
        const onBlur = () => setSpaceHeld(false);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
    }, []);
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const point = toHost(event);
            if (event.ctrlKey || event.metaKey) {
                designer.zoomTo(designer.view.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE), point);
                return;
            }
            if (designer.mode === 'preview') {
                const doc = designer.toDocument(point.x, point.y);
                if (designer.runtime.wheel(doc.x, doc.y, event.deltaX, event.deltaY))
                    return;
            }
            if (event.shiftKey && event.deltaX === 0)
                designer.panBy(-event.deltaY, 0);
            else
                designer.panBy(-event.deltaX, -event.deltaY);
        };
        host.addEventListener('wheel', onWheel, { passive: false });
        return () => host.removeEventListener('wheel', onWheel);
    }, [hostRef, designer, toHost]);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (designer.mode !== 'preview' || !designer.runtime.hasFocusedInput || isTextEntryTarget(event.target))
                return;
            if (designer.runtime.keyDown(event))
                event.preventDefault();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [designer]);
    const finishDrag = useCallback((dragging: Dragging, doc: GuiPoint, modifiers: DragModifiers) => {
        const { drag: current } = dragging;
        const liveLayout = designer.layout();
        switch (current.kind) {
            case 'move': {
                if (liveLayout && designer.document && !modifiers.ctrl) {
                    const target = pickDropContainer(liveLayout, designer.document.root, doc.x, doc.y, current.ids);
                    for (const id of current.ids) {
                        const entry = liveLayout.entries.get(id);
                        if (entry && entry.parentId !== target.node.id)
                            moveGuiNodeTo(session, id, target.node.id, target.node.children.length, true, current.mergeKey);
                    }
                }
                designer.endMerge();
                break;
            }
            case 'resize':
            case 'rotate':
                designer.endMerge();
                break;
            case 'marquee': {
                if (liveLayout && designer.document) {
                    const ids = marqueeSelection(liveLayout, designer.document.root, boxBetween(current.origin, doc));
                    designer.select(ids, { additive: current.additive });
                }
                break;
            }
            case 'draw': {
                const box = constrainDrawBox(current.origin, doc, modifiers.shift, modifiers.alt);
                const big = box.width * designer.view.zoom >= DRAG_THRESHOLD && box.height * designer.view.zoom >= DRAG_THRESHOLD;
                const id = addGuiElement(session, current.tool, big ? { box } : { at: centeredGuiDropPoint(session, current.tool, current.origin) });
                if (id && current.tool === 'text')
                    designer.beginTextEdit(id);
                break;
            }
            case 'pan':
                break;
        }
        setDrag(null);
    }, [designer, session]);
    const beginDragFrom = useCallback((pending: Pending): DragSession | null => {
        const liveLayout = designer.layout();
        const document = designer.document;
        switch (pending.hit.kind) {
            case 'pan':
                return { kind: 'pan', lastHost: pending.host };
            case 'draw':
                return { kind: 'draw', origin: pending.doc, tool: pending.hit.tool };
            case 'empty':
                return { kind: 'marquee', origin: pending.doc, additive: pending.modifiers.shift || pending.modifiers.ctrl };
            case 'element': {
                if (!liveLayout)
                    return null;
                if (pending.modifiers.alt && pending.hit.wasSelected)
                    duplicateSelectedGuiNodes(session, false);
                const ids = [...designer.selectedIds];
                const moveLayout = designer.layout();
                const move = moveLayout ? beginMove(moveLayout, ids, designer.primaryId, pending.doc) : null;
                return move ? { kind: 'move', session: move, ids, mergeKey: `gui-move-${++dragCounter}` } : null;
            }
            case 'handle': {
                if (!liveLayout || !document || !frame)
                    return null;
                return { kind: 'resize', session: beginResize(liveLayout, document.root, frame, designer.selectedIds, pending.hit.handle, pending.doc), mergeKey: `gui-resize-${++dragCounter}` };
            }
            case 'rotate': {
                if (!liveLayout || !document || !frame)
                    return null;
                return { kind: 'rotate', session: beginRotate(liveLayout, document.root, frame, designer.selectedIds, pending.doc), mergeKey: `gui-rotate-${++dragCounter}` };
            }
        }
    }, [designer, session, frame]);
}
