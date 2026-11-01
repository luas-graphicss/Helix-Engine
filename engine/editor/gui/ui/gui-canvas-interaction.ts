import type { GuiPoint } from '@/engine/gui/document/gui-document';
import type { GuiBox } from '@/engine/gui/layout/gui-layout';
export type GuiHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const GUI_HANDLES: readonly GuiHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const HANDLE_SIZE = 8;
const HANDLE_SLOP = 5;
const ROTATION_ZONE = 18;
export function handlePositions(box: GuiBox): Record<GuiHandle, GuiPoint> {
    const { x, y, width, height } = box;
    return {
        nw: { x, y },
        n: { x: x + width / 2, y },
        ne: { x: x + width, y },
        e: { x: x + width, y: y + height / 2 },
        se: { x: x + width, y: y + height },
        s: { x: x + width / 2, y: y + height },
        sw: { x, y: y + height },
        w: { x, y: y + height / 2 },
    };
}
export function handleCursor(handle: GuiHandle, rotation = 0): string {
    const order: GuiHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
    const cursors = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
    const steps = Math.round((((rotation % 360) + 360) % 360) / 45);
    const index = (order.indexOf(handle) + steps) % 8;
    return cursors[index];
}
export function hitHandle(box: GuiBox, point: GuiPoint, zoom: number): GuiHandle | null {
    const reach = (HANDLE_SIZE / 2 + HANDLE_SLOP) / zoom;
    const positions = handlePositions(box);
    for (const handle of ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'] as const) {
        const position = positions[handle];
        if (Math.abs(point.x - position.x) <= reach && Math.abs(point.y - position.y) <= reach)
            return handle;
    }
    return null;
}
export function hitRotationZone(box: GuiBox, point: GuiPoint, zoom: number): boolean {
    const zone = ROTATION_ZONE / zoom;
    const inner = (HANDLE_SIZE / 2 + HANDLE_SLOP) / zoom;
    const insideX = point.x >= box.x - zone && point.x <= box.x + box.width + zone;
    const insideY = point.y >= box.y - zone && point.y <= box.y + box.height + zone;
    if (!insideX || !insideY)
        return false;
    const nearLeft = point.x < box.x - inner;
    const nearRight = point.x > box.x + box.width + inner;
    const nearTop = point.y < box.y - inner;
    const nearBottom = point.y > box.y + box.height + inner;
    return (nearLeft || nearRight) && (nearTop || nearBottom);
}
export interface ResizeOptions {
    readonly keepAspect: boolean;
    readonly fromCenter: boolean;
    readonly minSize: GuiPoint;
}
export function resizeBox(start: GuiBox, handle: GuiHandle, dx: number, dy: number, options: ResizeOptions): GuiBox {
    const west = handle.includes('w');
    const east = handle.includes('e');
    const north = handle.includes('n');
    const south = handle.includes('s');
    const factor = options.fromCenter ? 2 : 1;
    let width = start.width + (east ? dx : west ? -dx : 0) * factor;
    let height = start.height + (south ? dy : north ? -dy : 0) * factor;
    if (options.keepAspect && start.width > 0 && start.height > 0) {
        const aspect = start.width / start.height;
        const horizontalOnly = (east || west) && !north && !south;
        const verticalOnly = (north || south) && !east && !west;
        if (horizontalOnly)
            height = width / aspect;
        else if (verticalOnly)
            width = height * aspect;
        else if (Math.abs(width / start.width) > Math.abs(height / start.height))
            height = width / aspect;
        else
            width = height * aspect;
    }
    width = Math.max(options.minSize.x, width);
    height = Math.max(options.minSize.y, height);
    let x = start.x;
    let y = start.y;
    if (options.fromCenter) {
        x = start.x + (start.width - width) / 2;
        y = start.y + (start.height - height) / 2;
    }
    else {
        if (west)
            x = start.x + start.width - width;
        if (north)
            y = start.y + start.height - height;
        if (options.keepAspect) {
            const horizontalOnly = (east || west) && !north && !south;
            const verticalOnly = (north || south) && !east && !west;
            if (horizontalOnly)
                y = start.y + (start.height - height) / 2;
            if (verticalOnly)
                x = start.x + (start.width - width) / 2;
        }
    }
    return { x, y, width, height };
}
export function angleAround(center: GuiPoint, point: GuiPoint): number {
    return (Math.atan2(point.x - center.x, -(point.y - center.y)) * 180) / Math.PI;
}
export function normalizeDegrees(degrees: number): number {
    const wrapped = ((degrees % 360) + 360) % 360;
    return wrapped > 180 ? wrapped - 360 : wrapped;
}
export function rotatePoint(x: number, y: number, degrees: number): GuiPoint {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
}
export function boxBetween(a: GuiPoint, b: GuiPoint): GuiBox {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}
export function constrainDrawBox(origin: GuiPoint, current: GuiPoint, square: boolean, fromCenter: boolean): GuiBox {
    let dx = current.x - origin.x;
    let dy = current.y - origin.y;
    if (square) {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * side;
        dy = Math.sign(dy || 1) * side;
    }
    if (fromCenter)
        return { x: origin.x - Math.abs(dx), y: origin.y - Math.abs(dy), width: Math.abs(dx) * 2, height: Math.abs(dy) * 2 };
    return boxBetween(origin, { x: origin.x + dx, y: origin.y + dy });
}
