import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { resolveGizmoAxes, resolveGizmoOrigin } from '../selection/gizmo-pivot';
import type { TransformTargets } from '../selection/transform-targets';
import type { GizmoTool, PivotMode, TransformSpace } from '../transform-settings';
import { copyGizmoAxes, gizmoSizeAt, type GizmoAxes, type GizmoFrame } from './gizmo-frame';
import type { GizmoLayout } from './gizmo-handle';
import { addMoveHandles } from './handles/move-handles';
import { addRotateHandles } from './handles/rotate-handles';
import { addScaleHandles } from './handles/scale-handles';
export interface GizmoLayoutRequest {
    readonly tool: GizmoTool;
    readonly targets: TransformTargets;
    readonly pivotMode: PivotMode;
    readonly space: TransformSpace;
    readonly camera: PerspectiveCamera;
    readonly scale: number;
    readonly frozenAxes: GizmoAxes | null;
}
type HandleSet = (layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera) => void;
const HANDLE_SETS: Record<GizmoTool, HandleSet> = {
    translate: addMoveHandles,
    rotate: addRotateHandles,
    scale: addScaleHandles,
};
function gizmoOrientation(tool: GizmoTool, space: TransformSpace): TransformSpace {
    return tool === 'scale' ? 'local' : space;
}
export function buildGizmoLayout(layout: GizmoLayout, frame: GizmoFrame, request: GizmoLayoutRequest): boolean {
    const { tool, targets, camera } = request;
    resolveGizmoOrigin(frame.origin, targets, request.pivotMode);
    if (request.frozenAxes)
        copyGizmoAxes(frame.axes, request.frozenAxes);
    else
        resolveGizmoAxes(frame.axes, targets.active, gizmoOrientation(tool, request.space));
    const size = gizmoSizeAt(frame.origin, camera, request.scale);
    if (size === null)
        return false;
    frame.size = size;
    layout.begin(size);
    HANDLE_SETS[tool](layout, frame, camera);
    return true;
}
