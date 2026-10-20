import { degToRad } from '@/engine/core/math/scalar';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export function pixelsPerTangent(camera: PerspectiveCamera, viewportHeight: number): number {
    return (viewportHeight * 0.5) / Math.tan(degToRad(camera.fovDegrees) * 0.5);
}
export function projectedDiameterPixels(radius: number, distance: number, pixelsPerTangentUnit: number): number {
    if (distance <= radius)
        return Infinity;
    return (2 * radius * pixelsPerTangentUnit) / Math.sqrt(distance * distance - radius * radius);
}
