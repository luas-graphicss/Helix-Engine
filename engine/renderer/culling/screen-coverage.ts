import { degToRad } from '@/engine/core/math/scalar';
import type { Aabb } from '@/engine/core/math/aabb';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export function projectAabbToNdcRect(box: Aabb, viewProjection: Mat4, out: Float32Array): boolean {
    const m = viewProjection;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let corner = 0; corner < 8; corner++) {
        const px = corner & 1 ? box.max[0] : box.min[0];
        const py = corner & 2 ? box.max[1] : box.min[1];
        const pz = corner & 4 ? box.max[2] : box.min[2];
        const w = m[3] * px + m[7] * py + m[11] * pz + m[15];
        if (w <= 1e-6)
            return false;
        const x = (m[0] * px + m[4] * py + m[8] * pz + m[12]) / w;
        const y = (m[1] * px + m[5] * py + m[9] * pz + m[13]) / w;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
    }
    out[0] = x0;
    out[1] = y0;
    out[2] = x1;
    out[3] = y1;
    return true;
}
export function pixelsPerTangent(camera: PerspectiveCamera, viewportHeight: number): number {
    return (viewportHeight * 0.5) / Math.tan(degToRad(camera.fovDegrees) * 0.5);
}
export function projectedDiameterPixels(radius: number, distance: number, pixelsPerTangentUnit: number): number {
    if (distance <= radius)
        return Infinity;
    return (2 * radius * pixelsPerTangentUnit) / Math.sqrt(distance * distance - radius * radius);
}
