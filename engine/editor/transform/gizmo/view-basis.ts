import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export function cameraRight(out: Vec3, camera: PerspectiveCamera): Vec3 {
    const view = camera.viewMatrix;
    return vec3.set(out, view[0], view[4], view[8]);
}
export function cameraUp(out: Vec3, camera: PerspectiveCamera): Vec3 {
    const view = camera.viewMatrix;
    return vec3.set(out, view[1], view[5], view[9]);
}
export function directionToCamera(out: Vec3, camera: PerspectiveCamera, point: Vec3): Vec3 {
    vec3.subtract(out, camera.position, point);
    return vec3.normalize(out, out);
}
