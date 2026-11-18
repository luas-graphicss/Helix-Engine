import { degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { GizmoDrag } from '@/engine/editor/transform/drag/gizmo-drag';
import { createGizmoFrame, type AxisIndex, type GizmoFrame } from '@/engine/editor/transform/gizmo/gizmo-frame';
import { GizmoLayout } from '@/engine/editor/transform/gizmo/gizmo-handle';
import { buildGizmoLayout } from '@/engine/editor/transform/gizmo/gizmo-layout';
import type { GizmoPointer } from '@/engine/editor/transform/gizmo/gizmo-pointer';
import { SnapTargets } from '@/engine/editor/transform/snap/snap-targets';
import type { GizmoTool, PivotMode } from '@/engine/editor/transform/transform-settings';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCamera, type Triple } from './transform-fixture';
export interface Stage {
    readonly scene: Scene;
    readonly camera: PerspectiveCamera;
    readonly boxes: readonly Entity[];
}
export interface StageGizmo {
    readonly layout: GizmoLayout;
    readonly frame: GizmoFrame;
}
export interface ActiveDrag {
    readonly drag: GizmoDrag;
    readonly frame: GizmoFrame;
}
export function createStage(...positions: Triple[]): Stage {
    const scene = new Scene();
    const boxes = positions.map((position, index) => {
        const box = scene.createEntity({ name: `Caixa ${index + 1}`, kind: 'mesh', mesh: createBox(1, 1, 1) });
        vec3.set(box.transform.position, ...position);
        return box;
    });
    scene.updateWorldMatrices();
    return { scene, camera: createCamera([0, 0, 10]), boxes };
}
export function alongAxis(frame: GizmoFrame, axis: AxisIndex, units: number): Triple {
    const point = vec3.scaleAndAdd(vec3.create(), frame.origin, frame.axes[axis], units * frame.size);
    return [point[0], point[1], point[2]];
}
export function onRing(frame: GizmoFrame, degrees: number): Triple {
    const angle = degToRad(degrees);
    return [frame.origin[0] + Math.cos(angle) * frame.size, frame.origin[1] + Math.sin(angle) * frame.size, frame.origin[2]];
}
export function buildStageGizmo({ scene, camera, boxes }: Stage, tool: GizmoTool, pivotMode: PivotMode): StageGizmo {
    scene.updateWorldMatrices();
    const targets = { entities: boxes, active: boxes[boxes.length - 1] };
    const layout = new GizmoLayout();
    const frame = createGizmoFrame();
    if (!buildGizmoLayout(layout, frame, { tool, targets, pivotMode, space: 'global', camera, scale: 1, frozenAxes: null }))
        throw new Error('O gizmo deveria estar na frente da câmera');
    return { layout, frame };
}
export function beginDrag(stage: Stage, tool: GizmoTool, handleId: string, pivotMode: PivotMode, start: (frame: GizmoFrame) => GizmoPointer): ActiveDrag {
    const { scene, camera, boxes } = stage;
    const { layout, frame } = buildStageGizmo(stage, tool, pivotMode);
    const handle = layout.find(handleId);
    if (!handle)
        throw new Error(`A alça ${handleId} deveria existir nesta vista`);
    const targets = { entities: boxes, active: boxes[boxes.length - 1] };
    const drag = GizmoDrag.begin({ camera, frame, handle, targets, pivotMode, pointer: start(frame), snapTargets: new SnapTargets(scene, boxes) });
    if (!drag)
        throw new Error(`O arrasto de ${handleId} deveria começar`);
    return { drag, frame };
}
