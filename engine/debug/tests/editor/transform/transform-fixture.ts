import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { SnapSource } from '@/engine/editor/transform/drag/gizmo-drag';
import type { GizmoPointer } from '@/engine/editor/transform/gizmo/gizmo-pointer';
import { createScreenPoint, projectToScreen } from '@/engine/editor/viewport/screen-space';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export type Triple = [number, number, number];
export interface PointerModifiers {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}
export const VIEWPORT_SIZE = 800;
export const NO_SNAP: SnapSource = { enabled: false, target: 'increment', translate: 0.5, rotate: 15, scale: 0.1 };
export function createCamera(position: Triple, target: Triple = [0, 0, 0]): PerspectiveCamera {
    const camera = new PerspectiveCamera();
    vec3.set(camera.position, ...position);
    vec3.set(camera.target, ...target);
    camera.updateMatrices();
    return camera;
}
export function pointerAt(x: number, y: number, modifiers: PointerModifiers = {}): GizmoPointer {
    return { x, y, width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, ctrl: modifiers.ctrl ?? false, shift: modifiers.shift ?? false, alt: modifiers.alt ?? false };
}
export function pointerOver(camera: PerspectiveCamera, point: ArrayLike<number>, modifiers: PointerModifiers = {}): GizmoPointer {
    const screen = createScreenPoint();
    if (!projectToScreen(screen, camera.viewProjectionMatrix, vec3.create(point[0], point[1], point[2]), VIEWPORT_SIZE, VIEWPORT_SIZE))
        throw new Error(`O ponto ${Array.from(point).join(', ')} está atrás da câmera`);
    return pointerAt(screen[0], screen[1], modifiers);
}
export function worldPositionOf(scene: Scene, entity: Entity): Triple {
    scene.updateWorldMatrices();
    return [entity.worldMatrix[12], entity.worldMatrix[13], entity.worldMatrix[14]];
}
export function worldAxisOf(scene: Scene, entity: Entity, axis: 0 | 1 | 2): Triple {
    scene.updateWorldMatrices();
    const column = axis * 4;
    const matrix = entity.worldMatrix;
    const length = Math.hypot(matrix[column], matrix[column + 1], matrix[column + 2]);
    return [matrix[column] / length, matrix[column + 1] / length, matrix[column + 2] / length];
}
