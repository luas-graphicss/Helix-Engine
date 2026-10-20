import type { Aabb } from '@/engine/core/math/aabb';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
const PLANE_COUNT = 6;
export const CULL_OUTSIDE = 0;
export const CULL_INTERSECTS = 1;
export const CULL_INSIDE = 2;
export type CullResult = typeof CULL_OUTSIDE | typeof CULL_INTERSECTS | typeof CULL_INSIDE;
export class Frustum {
    private readonly planes = new Float32Array(PLANE_COUNT * 4);
    setFromViewProjection(m: Mat4): this {
        const { planes } = this;
        const w0 = m[3], w1 = m[7], w2 = m[11], w3 = m[15];
        for (let row = 0; row < 3; row++) {
            const r0 = m[row], r1 = m[4 + row], r2 = m[8 + row], r3 = m[12 + row];
            const positive = row * 8;
            planes[positive] = w0 + r0;
            planes[positive + 1] = w1 + r1;
            planes[positive + 2] = w2 + r2;
            planes[positive + 3] = w3 + r3;
            planes[positive + 4] = w0 - r0;
            planes[positive + 5] = w1 - r1;
            planes[positive + 6] = w2 - r2;
            planes[positive + 7] = w3 - r3;
        }
        for (let i = 0; i < planes.length; i += 4) {
            const inv = 1 / Math.hypot(planes[i], planes[i + 1], planes[i + 2]);
            planes[i] *= inv;
            planes[i + 1] *= inv;
            planes[i + 2] *= inv;
            planes[i + 3] *= inv;
        }
        return this;
    }
    intersectsAabb(box: Aabb): boolean {
        const { planes } = this;
        const { min, max } = box;
        for (let i = 0; i < planes.length; i += 4) {
            const a = planes[i], b = planes[i + 1], c = planes[i + 2], d = planes[i + 3];
            const x = a >= 0 ? max[0] : min[0];
            const y = b >= 0 ? max[1] : min[1];
            const z = c >= 0 ? max[2] : min[2];
            if (a * x + b * y + c * z + d < 0)
                return false;
        }
        return true;
    }
    classifyAabb(box: Aabb): CullResult {
        const { planes } = this;
        const { min, max } = box;
        let intersects = false;
        for (let i = 0; i < planes.length; i += 4) {
            const a = planes[i], b = planes[i + 1], c = planes[i + 2], d = planes[i + 3];
            const px = a >= 0 ? max[0] : min[0];
            const py = b >= 0 ? max[1] : min[1];
            const pz = c >= 0 ? max[2] : min[2];
            if (a * px + b * py + c * pz + d < 0)
                return CULL_OUTSIDE;
            const nx = a >= 0 ? min[0] : max[0];
            const ny = b >= 0 ? min[1] : max[1];
            const nz = c >= 0 ? min[2] : max[2];
            if (a * nx + b * ny + c * nz + d < 0)
                intersects = true;
        }
        return intersects ? CULL_INTERSECTS : CULL_INSIDE;
    }
    intersectsSphere(center: Vec3, radius: number): boolean {
        const { planes } = this;
        const x = center[0], y = center[1], z = center[2];
        for (let i = 0; i < planes.length; i += 4) {
            if (planes[i] * x + planes[i + 1] * y + planes[i + 2] * z + planes[i + 3] < -radius)
                return false;
        }
        return true;
    }
}
