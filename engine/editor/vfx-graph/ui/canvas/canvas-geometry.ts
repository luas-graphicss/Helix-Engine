import { CONTEXT_WIDTH, contextHeight, SYSTEM_GAP } from '@/engine/vfx-graph/document/context-layout';
import type { EffectContext } from '@/engine/vfx-graph/document/effect-document';
import type { CanvasSize, CanvasView } from '../../vfx-graph-editor';
const MIN_WIRE_REACH = 28;
const FIRST_SYSTEM_ORIGIN: CanvasPoint = { x: 40, y: 40 };
export interface CanvasPoint {
    readonly x: number;
    readonly y: number;
}
export function flowInPoint(context: EffectContext): CanvasPoint {
    return { x: context.x + CONTEXT_WIDTH / 2, y: context.y };
}
export function flowOutPoint(context: EffectContext): CanvasPoint {
    return { x: context.x + CONTEXT_WIDTH / 2, y: context.y + contextHeight(context) };
}
export function contextCenter(context: EffectContext): CanvasPoint {
    return { x: context.x + CONTEXT_WIDTH / 2, y: context.y + contextHeight(context) / 2 };
}
export function flowPath(from: CanvasPoint, to: CanvasPoint): string {
    const reach = Math.max(MIN_WIRE_REACH, Math.abs(to.y - from.y) / 2);
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + reach}, ${to.x} ${to.y - reach}, ${to.x} ${to.y}`;
}
export function visibleCenter(view: CanvasView, size: CanvasSize): CanvasPoint {
    return { x: (size.width / 2 - view.x) / view.zoom, y: (size.height / 2 - view.y) / view.zoom };
}
export function viewCenteredOn(view: CanvasView, size: CanvasSize, point: CanvasPoint): CanvasView {
    return { zoom: view.zoom, x: size.width / 2 - point.x * view.zoom, y: size.height / 2 - point.y * view.zoom };
}
export function nextSystemOrigin(contexts: readonly EffectContext[]): CanvasPoint {
    if (contexts.length === 0)
        return FIRST_SYSTEM_ORIGIN;
    return { x: Math.max(...contexts.map((context) => context.x)) + CONTEXT_WIDTH + SYSTEM_GAP, y: Math.min(...contexts.map((context) => context.y)) };
}
