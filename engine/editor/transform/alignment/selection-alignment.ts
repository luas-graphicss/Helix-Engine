import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { TransformChange } from '@/engine/editor/operations/transform-operations';
import { computeWorldBounds } from '@/engine/renderer/geometry/bounds';
import { applyTransformDelta } from '../apply/apply-transform-delta';
import { captureTargetState, collectTargetChanges } from '../apply/target-state';
import { createTransformDelta } from '../apply/transform-delta';
import type { AxisIndex } from '../gizmo/gizmo-frame';
export type AlignEdge = 'min' | 'center' | 'max';
export interface AlignmentBox {
    readonly entity: Entity;
    readonly bounds: Aabb;
}
export function measureAlignmentBox(scene: Scene, entity: Entity): AlignmentBox {
    const bounds = computeWorldBounds(scene, entity);
    if (aabb.isEmpty(bounds)) {
        mat4.getTranslation(bounds.min, entity.worldMatrix);
        vec3.copy(bounds.max, bounds.min);
    }
    return { entity, bounds };
}
function edgeOf(bounds: Aabb, axis: AxisIndex, edge: AlignEdge): number {
    switch (edge) {
        case 'min':
            return bounds.min[axis];
        case 'center':
            return (bounds.min[axis] + bounds.max[axis]) / 2;
        case 'max':
            return bounds.max[axis];
    }
}
function extentOf(bounds: Aabb, axis: AxisIndex): number {
    return bounds.max[axis] - bounds.min[axis];
}
export function alignmentOffsets(boxes: readonly AlignmentBox[], reference: AlignmentBox, axis: AxisIndex, edge: AlignEdge): number[] {
    const target = edgeOf(reference.bounds, axis, edge);
    return boxes.map((box) => target - edgeOf(box.bounds, axis, edge));
}
export function distributionOffsets(boxes: readonly AlignmentBox[], axis: AxisIndex): number[] {
    const offsets = boxes.map(() => 0);
    if (boxes.length < 2)
        return offsets;
    const order = boxes.map((_, index) => index).sort((a, b) => boxes[a].bounds.min[axis] - boxes[b].bounds.min[axis]);
    const first = boxes[order[0]].bounds;
    const last = boxes[order[order.length - 1]].bounds;
    const occupied = boxes.reduce((total, box) => total + extentOf(box.bounds, axis), 0);
    const gap = (last.max[axis] - first.min[axis] - occupied) / (boxes.length - 1);
    let cursor = first.min[axis];
    for (const index of order) {
        const { bounds } = boxes[index];
        offsets[index] = cursor - bounds.min[axis];
        cursor += extentOf(bounds, axis) + gap;
    }
    return offsets;
}
export function applyAxisOffsets(boxes: readonly AlignmentBox[], offsets: readonly number[], axis: AxisIndex): TransformChange[] {
    const delta = createTransformDelta();
    const states = boxes.map((box) => captureTargetState(box.entity));
    states.forEach((state, index) => {
        vec3.set(delta.translation, 0, 0, 0);
        delta.translation[axis] = offsets[index];
        applyTransformDelta(state, delta);
    });
    return collectTargetChanges(states);
}
