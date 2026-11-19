import type { ShaderGraphDocument, SocketRef } from '@/engine/shader-graph/document/graph-document';
import { nodeDefinition } from '@/engine/shader-graph/nodes/node-catalog';
import type { SocketKind } from '@/engine/shader-graph/nodes/socket-types';
import { cn } from '@/lib/utils';
import { SOCKET_STROKE_CLASS } from '../node-appearance';
import { inputSocketPosition, outputSocketPosition, wirePath, type CanvasPoint } from './canvas-geometry';
export interface PendingWire {
    readonly from: SocketRef;
    readonly to: CanvasPoint;
}
type GraphWiresProps = {
    graph: ShaderGraphDocument;
    pendingWire: PendingWire | null;
};
export function GraphWires({ graph, pendingWire }: GraphWiresProps) {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const outputOf = (ref: SocketRef): {
        point: CanvasPoint;
        kind: SocketKind;
    } | null => {
        const node = nodes.get(ref.node);
        const definition = node ? nodeDefinition(node.type) : null;
        const socket = definition?.outputs.find((candidate) => candidate.id === ref.socket);
        const point = node && definition ? outputSocketPosition(node, definition, ref.socket) : null;
        return socket && point ? { point, kind: socket.type } : null;
    };
    const inputOf = (ref: SocketRef): CanvasPoint | null => {
        const node = nodes.get(ref.node);
        const definition = node ? nodeDefinition(node.type) : null;
        return node && definition ? inputSocketPosition(node, definition, ref.socket) : null;
    };
    const pendingOrigin = pendingWire ? outputOf(pendingWire.from) : null;
    return (<svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
      {graph.links.map((link) => {
            const from = outputOf(link.from);
            const to = inputOf(link.to);
            if (!from || !to)
                return null;
            return <path key={link.id} d={wirePath(from.point, to)} className={cn('fill-none stroke-2', SOCKET_STROKE_CLASS[from.kind])}/>;
        })}
      {pendingWire && pendingOrigin && <path d={wirePath(pendingOrigin.point, pendingWire.to)} strokeDasharray="5 4" className={cn('fill-none stroke-2', SOCKET_STROKE_CLASS[pendingOrigin.kind])}/>}
    </svg>);
}
