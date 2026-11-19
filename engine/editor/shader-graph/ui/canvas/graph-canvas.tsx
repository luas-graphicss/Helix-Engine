'use client';
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { linkInto, type ShaderGraphDocument, type SocketRef } from '@/engine/shader-graph/document/graph-document';
import { nodeDefinition } from '@/engine/shader-graph/nodes/node-catalog';
import { useElementSize } from '@/engine/ui/use-element-size';
import { useShaderGraph } from '../use-shader-graph';
import type { CanvasPoint } from './canvas-geometry';
import { NODE_HEADER_HEIGHT, NODE_WIDTH } from './canvas-geometry';
import { GraphNodeCard } from './graph-node-card';
import { GraphWires, type PendingWire } from './graph-wires';
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
    readonly kind: 'wire';
    readonly from: SocketRef;
};
interface WireOrigin {
    readonly from: SocketRef;
    readonly detachedLinkId: string | null;
}
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const ZOOM_SPEED = 0.0015;
const GRID_SPACING = 24;
const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;
const NO_LINKED_INPUTS: ReadonlySet<string> = new Set();
function wireOrigin(graph: ShaderGraphDocument, nodeId: string, socket: HTMLElement): WireOrigin | null {
    const socketId = socket.dataset.socketId;
    if (!socketId)
        return null;
    if (socket.dataset.socketSide === 'out')
        return { from: { node: nodeId, socket: socketId }, detachedLinkId: null };
    const link = linkInto(graph, { node: nodeId, socket: socketId });
    return link ? { from: link.from, detachedLinkId: link.id } : null;
}
function droppedInput(clientX: number, clientY: number): SocketRef | null {
    const socket = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-socket-side="in"]');
    const node = socket?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
    const socketId = socket?.dataset.socketId;
    return node && socketId ? { node, socket: socketId } : null;
}
export function GraphCanvas() {
    const editor = useShaderGraph();
    const rootRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const [pendingWire, setPendingWire] = useState<PendingWire | null>(null);
    const size = useElementSize(rootRef);
    useEffect(() => editor.setViewportSize(size), [editor, size]);
    const graph = editor.document;
    if (!graph)
        return null;
    const { view, selection, compiled } = editor;
    const failedNodes = new Set(compiled?.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.nodeId));
    const linkedInputs = new Map<string, Set<string>>();
    for (const link of graph.links) {
        const sockets = linkedInputs.get(link.to.node) ?? new Set<string>();
        sockets.add(link.to.socket);
        linkedInputs.set(link.to.node, sockets);
    }
    const toGraphPoint = (clientX: number, clientY: number): CanvasPoint => {
        const rect = rootRef.current?.getBoundingClientRect();
        return { x: (clientX - (rect?.left ?? 0) - view.x) / view.zoom, y: (clientY - (rect?.top ?? 0) - view.y) / view.zoom };
    };
    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest('input, select, textarea, button'))
            return;
        const socket = target.closest<HTMLElement>('[data-socket-side]');
        const nodeId = target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
        if (event.button === PRIMARY_BUTTON && socket && nodeId) {
            const origin = wireOrigin(graph, nodeId, socket);
            if (!origin)
                return;
            if (origin.detachedLinkId)
                editor.disconnect(origin.detachedLinkId);
            gesture.current = { kind: 'wire', from: origin.from };
            setPendingWire({ from: origin.from, to: toGraphPoint(event.clientX, event.clientY) });
        }
        else if (event.button === PRIMARY_BUTTON && nodeId) {
            if (event.shiftKey || !selection.has(nodeId))
                editor.select(nodeId, event.shiftKey);
            gesture.current = { kind: 'move', lastX: event.clientX, lastY: event.clientY };
        }
        else if (event.button === PRIMARY_BUTTON || event.button === MIDDLE_BUTTON) {
            if (event.button === PRIMARY_BUTTON)
                editor.clearSelection();
            gesture.current = { kind: 'pan', pointerX: event.clientX, pointerY: event.clientY, originX: view.x, originY: view.y };
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
        if (current.kind === 'wire') {
            setPendingWire({ from: current.from, to: toGraphPoint(event.clientX, event.clientY) });
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
        if (current.kind !== 'wire')
            return;
        setPendingWire(null);
        const target = cancelled ? null : droppedInput(event.clientX, event.clientY);
        if (target)
            editor.connect(current.from, target);
    };
    const onWheel = (event: WheelEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * Math.exp(-event.deltaY * ZOOM_SPEED)));
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const scale = zoom / view.zoom;
        editor.setView({ zoom, x: pointerX - (pointerX - view.x) * scale, y: pointerY - (pointerY - view.y) * scale });
    };
    const grid = GRID_SPACING * view.zoom;
    return (<div ref={rootRef} role="application" aria-label="Grafo de shader: arraste o fundo para mover, role para aproximar, puxe de uma saída até uma entrada para ligar" className="relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden bg-surface-sunken select-none" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(event) => finishGesture(event, false)} onPointerCancel={(event) => finishGesture(event, true)} onWheel={onWheel}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <GraphWires graph={graph} pendingWire={pendingWire}/>
        {graph.nodes.map((node) => {
            const definition = nodeDefinition(node.type);
            if (!definition) {
                return (<div key={node.id} data-node-id={node.id} className="absolute flex items-center rounded-sm bg-surface-raised px-2 text-2xs text-destructive ring-1 ring-destructive" style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEADER_HEIGHT }}>
                  Nó desconhecido: {node.type}
                </div>);
            }
            return <GraphNodeCard key={node.id} node={node} definition={definition} selected={selection.has(node.id)} failed={failedNodes.has(node.id)} linkedInputs={linkedInputs.get(node.id) ?? NO_LINKED_INPUTS} onSelect={(additive) => editor.select(node.id, additive)} onValueChange={(key, value) => editor.setValue(node.id, key, value)}/>;
        })}
      </div>
    </div>);
}
