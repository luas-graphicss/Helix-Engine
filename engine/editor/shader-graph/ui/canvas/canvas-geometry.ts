import type { GraphNode } from '@/engine/shader-graph/document/graph-document';
import type { NodeDefinition } from '@/engine/shader-graph/nodes/node-definition';
import type { GraphView, GraphViewportSize } from '../../shader-graph-editor';
export const NODE_WIDTH = 188;
export const NODE_HEADER_HEIGHT = 26;
export const NODE_ROW_HEIGHT = 22;
export const NODE_BODY_PADDING = 5;
export const NODE_SUMMARY_HEIGHT = 20;
const MIN_WIRE_REACH = 36;
export interface CanvasPoint {
    readonly x: number;
    readonly y: number;
}
function rowCenter(node: GraphNode, row: number): number {
    return node.y + NODE_HEADER_HEIGHT + NODE_BODY_PADDING + row * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2;
}
export function outputSocketPosition(node: GraphNode, definition: NodeDefinition, socketId: string): CanvasPoint | null {
    const index = definition.outputs.findIndex((socket) => socket.id === socketId);
    return index < 0 ? null : { x: node.x + NODE_WIDTH, y: rowCenter(node, index) };
}
export function inputSocketPosition(node: GraphNode, definition: NodeDefinition, socketId: string): CanvasPoint | null {
    const index = definition.inputs.findIndex((socket) => socket.id === socketId);
    return index < 0 ? null : { x: node.x, y: rowCenter(node, definition.outputs.length + index) };
}
export function wirePath(from: CanvasPoint, to: CanvasPoint): string {
    const reach = Math.max(MIN_WIRE_REACH, Math.abs(to.x - from.x) / 2);
    return `M ${from.x} ${from.y} C ${from.x + reach} ${from.y}, ${to.x - reach} ${to.y}, ${to.x} ${to.y}`;
}
export function visibleCenter(view: GraphView, size: GraphViewportSize): CanvasPoint {
    return { x: (size.width / 2 - view.x) / view.zoom, y: (size.height / 2 - view.y) / view.zoom };
}
