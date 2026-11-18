import type { Mat4 } from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
export type ScreenPoint = Float32Array;
export function createScreenPoint(): ScreenPoint {
    return new Float32Array(2);
}
export function projectToScreen(out: ScreenPoint, viewProjection: Mat4, point: Vec3, width: number, height: number): boolean {
    const x = point[0], y = point[1], z = point[2];
    const clipW = viewProjection[3] * x + viewProjection[7] * y + viewProjection[11] * z + viewProjection[15];
    if (clipW <= 1e-6)
        return false;
    const clipX = (viewProjection[0] * x + viewProjection[4] * y + viewProjection[8] * z + viewProjection[12]) / clipW;
    const clipY = (viewProjection[1] * x + viewProjection[5] * y + viewProjection[9] * z + viewProjection[13]) / clipW;
    out[0] = (clipX * 0.5 + 0.5) * width;
    out[1] = (0.5 - clipY * 0.5) * height;
    return true;
}
export function distanceToSegment2D(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    let t = lengthSquared > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
export function pointInConvexQuad2D(px: number, py: number, quad: ArrayLike<number>): boolean {
    let positive = false;
    let negative = false;
    for (let i = 0; i < 4; i++) {
        const ax = quad[i * 2], ay = quad[i * 2 + 1];
        const bx = quad[((i + 1) % 4) * 2], by = quad[((i + 1) % 4) * 2 + 1];
        const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        if (cross > 0)
            positive = true;
        else if (cross < 0)
            negative = true;
        if (positive && negative)
            return false;
    }
    return true;
}
