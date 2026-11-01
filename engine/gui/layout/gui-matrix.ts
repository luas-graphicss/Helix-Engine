import type { GuiPoint } from '@/engine/gui/document/gui-document';
export type GuiMatrix = readonly [
    number,
    number,
    number,
    number,
    number,
    number
];
export const GUI_IDENTITY: GuiMatrix = [1, 0, 0, 1, 0, 0];
export function matrixMultiply(m: GuiMatrix, n: GuiMatrix): GuiMatrix {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
export function matrixTranslate(m: GuiMatrix, x: number, y: number): GuiMatrix {
    return [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
export function matrixRotate(m: GuiMatrix, degrees: number): GuiMatrix {
    if (degrees === 0)
        return m;
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return matrixMultiply(m, [cos, sin, -sin, cos, 0, 0]);
}
export function matrixScale(m: GuiMatrix, sx: number, sy: number): GuiMatrix {
    return [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
}
export function matrixInvert(m: GuiMatrix): GuiMatrix {
    const det = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(det) < 1e-12)
        return GUI_IDENTITY;
    const inv = 1 / det;
    return [m[3] * inv, -m[1] * inv, -m[2] * inv, m[0] * inv, (m[2] * m[5] - m[3] * m[4]) * inv, (m[1] * m[4] - m[0] * m[5]) * inv];
}
export function applyMatrix(m: GuiMatrix, x: number, y: number): GuiPoint {
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
export function matrixScaleFactor(m: GuiMatrix): number {
    return Math.hypot(m[0], m[1]);
}
export function transformedBounds(m: GuiMatrix, width: number, height: number): {
    x: number;
    y: number;
    width: number;
    height: number;
} {
    const corners = [applyMatrix(m, 0, 0), applyMatrix(m, width, 0), applyMatrix(m, width, height), applyMatrix(m, 0, height)];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const corner of corners) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
