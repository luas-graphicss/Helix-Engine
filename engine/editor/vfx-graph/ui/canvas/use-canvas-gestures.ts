'use client';
import { useRef, useState, type PointerEvent, type RefObject, type WheelEvent } from 'react';
import { flowInto, type VfxGraphDocument } from '@/engine/vfx-graph/document/effect-document';
import type { VfxGraphEditor } from '../../vfx-graph-editor';
import type { CanvasPoint } from './canvas-geometry';
import type { PendingFlow } from './flow-wires';
type Gesture = {
    readonly kind: 'pan';
    readonly pointerX: number;
    readonly pointerY: number;
    readonly originX: number;
    readonly originY: number;
} | {
    readonly kind: 'move';
    lastX: number;
    lastY: number;
} | {
    readonly kind: 'flow';
    readonly fromId: string;
};
interface FlowOrigin {
    readonly fromId: string;
    readonly detachedLinkId: string | null;
}
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const ZOOM_SPEED = 0.0015;
const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;
function flowOrigin(graph: VfxGraphDocument, contextId: string, port: HTMLElement): FlowOrigin | null {
    if (port.dataset.flowPort === 'out')
        return { fromId: contextId, detachedLinkId: null };
    const link = flowInto(graph, contextId);
    return link ? { fromId: link.from, detachedLinkId: link.id } : null;
}
function droppedContext(clientX: number, clientY: number): string | null {
    return document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-context-id]')?.dataset.contextId ?? null;
}
export function useCanvasGestures(editor: VfxGraphEditor, rootRef: RefObject<HTMLDivElement | null>) {
    const gesture = useRef<Gesture | null>(null);
    const [pendingFlow, setPendingFlow] = useState<PendingFlow | null>(null);
    const toGraphPoint = (clientX: number, clientY: number): CanvasPoint => {
        const rect = rootRef.current?.getBoundingClientRect();
        const { view } = editor;
        return { x: (clientX - (rect?.left ?? 0) - view.x) / view.zoom, y: (clientY - (rect?.top ?? 0) - view.y) / view.zoom };
    };
    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const graph = editor.document;
        const target = event.target instanceof Element ? event.target : null;
        if (!graph || !target || !event.currentTarget.contains(target) || target.closest('input, select, textarea, button'))
            return;
        const port = target.closest<HTMLElement>('[data-flow-port]');
        const contextId = target.closest<HTMLElement>('[data-context-id]')?.dataset.contextId;
        if (event.button === PRIMARY_BUTTON && port && contextId) {
            const origin = flowOrigin(graph, contextId, port);
            if (!origin)
                return;
            if (origin.detachedLinkId)
                editor.disconnect(origin.detachedLinkId);
            gesture.current = { kind: 'flow', fromId: origin.fromId };
            setPendingFlow({ fromId: origin.fromId, to: toGraphPoint(event.clientX, event.clientY) });
        }
        else if (event.button === PRIMARY_BUTTON && contextId) {
            if (event.shiftKey || editor.selectedBlock || !editor.selectedContexts.has(contextId))
                editor.selectContext(contextId, event.shiftKey);
            gesture.current = { kind: 'move', lastX: event.clientX, lastY: event.clientY };
        }
        else if (event.button === PRIMARY_BUTTON || event.button === MIDDLE_BUTTON) {
            if (event.button === PRIMARY_BUTTON)
                editor.clearSelection();
            gesture.current = { kind: 'pan', pointerX: event.clientX, pointerY: event.clientY, originX: editor.view.x, originY: editor.view.y };
        }
        else
            return;
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = gesture.current;
        if (!current)
            return;
        if (current.kind === 'pan') {
            editor.setView({ ...editor.view, x: current.originX + event.clientX - current.pointerX, y: current.originY + event.clientY - current.pointerY });
            return;
        }
        if (current.kind === 'flow') {
            setPendingFlow({ fromId: current.fromId, to: toGraphPoint(event.clientX, event.clientY) });
            return;
        }
        const { zoom } = editor.view;
        editor.moveSelected((event.clientX - current.lastX) / zoom, (event.clientY - current.lastY) / zoom);
        current.lastX = event.clientX;
        current.lastY = event.clientY;
    };
    const finishGesture = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
        const current = gesture.current;
        gesture.current = null;
        if (!current)
            return;
        if (current.kind === 'move')
            editor.endGesture();
        if (current.kind !== 'flow')
            return;
        setPendingFlow(null);
        const targetId = cancelled ? null : droppedContext(event.clientX, event.clientY);
        if (targetId && targetId !== current.fromId)
            editor.connect(current.fromId, targetId);
    };
    const onWheel = (event: WheelEvent<HTMLDivElement>) => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target))
            return;
        const { view } = editor;
        const rect = event.currentTarget.getBoundingClientRect();
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * Math.exp(-event.deltaY * ZOOM_SPEED)));
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const scale = zoom / view.zoom;
        editor.setView({ zoom, x: pointerX - (pointerX - view.x) * scale, y: pointerY - (pointerY - view.y) * scale });
    };
    return {
        pendingFlow,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: (event: PointerEvent<HTMLDivElement>) => finishGesture(event, false),
            onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finishGesture(event, true),
            onWheel,
        },
    };
}
