import * as vec3 from '@/engine/core/math/vec3';
import { createGizmoAxes, nextAxis, previousAxis } from '../gizmo/gizmo-frame';
import type { GizmoHandle } from '../gizmo/gizmo-handle';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { directionToCamera } from '../gizmo/view-basis';
import type { DragEnvironment, HandleManipulation } from './handle-manipulation';
import { AxisRotation } from './rotate-drag';
import { AxisScale, PlaneScale, UniformScale } from './scale-drag';
import { AxisTranslation, PlaneTranslation } from './translate-drag';
const WORLD_AXES = createGizmoAxes();
export function createManipulation(handle: GizmoHandle, environment: DragEnvironment, pointer: GizmoPointer): HandleManipulation | null {
    const { action } = handle;
    if (!action)
        return null;
    const { camera, frame } = environment;
    switch (action.kind) {
        case 'translateAxis':
            return new AxisTranslation(environment, action.axis);
        case 'translatePlane':
            return new PlaneTranslation(environment, frame.axes[action.normal], [frame.axes[nextAxis(action.normal)], frame.axes[previousAxis(action.normal)]]);
        case 'translateView':
            return new PlaneTranslation(environment, directionToCamera(vec3.create(), camera, frame.origin), WORLD_AXES);
        case 'rotateAxis':
            return new AxisRotation(environment, frame.axes[action.axis], handle.radius, pointer);
        case 'rotateView':
            return new AxisRotation(environment, directionToCamera(vec3.create(), camera, frame.origin), handle.radius, pointer);
        case 'scaleAxis':
            return new AxisScale(environment, action.axis);
        case 'scalePlane':
            return new PlaneScale(environment, action.normal);
        case 'scaleUniform':
            return new UniformScale(environment, pointer);
    }
}
