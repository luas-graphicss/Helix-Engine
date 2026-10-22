import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { CsgBrushShape } from '@/engine/geometry/csg/csg-settings';
export type Axis = 0 | 1 | 2;
export type AxisSide = 1 | -1;
export const AXIS_LABEL: Record<Axis, string> = { 0: 'X', 1: 'Y', 2: 'Z' };
const BRUSH_FOOTPRINT = 0.4;
const BRUSH_THROUGH = 1.5;
const SHAPE_DIAMETER: Record<CsgBrushShape, number> = { box: 1, cylinder: 1, sphere: 1, capsule: 0.5, cone: 1, torus: 1.4 };
const AXIAL_SHAPES: ReadonlySet<CsgBrushShape> = new Set(['cylinder', 'capsule', 'cone', 'torus']);
const SLICE_MARGIN = 0.1;
const MIN_HOLLOW_SCALE = 0.05;
const HOLLOW_THICKNESS_FRACTION = 0.1;
export function targetSourceMesh(target: Entity): MeshData {
    return target.csg?.sourceMesh ?? (target.mesh as MeshData);
}
interface SourceExtents {
    center: Float32Array;
    size: number[];
}
function sourceExtents(target: Entity): SourceExtents {
    const bounds = getLocalBounds(targetSourceMesh(target));
    return {
        center: vec3.create((bounds.min[0] + bounds.max[0]) * 0.5, (bounds.min[1] + bounds.max[1]) * 0.5, (bounds.min[2] + bounds.max[2]) * 0.5),
        size: [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]],
    };
}
export function placeBrush(brush: Entity, target: Entity, shape: CsgBrushShape): void {
    const { center, size } = sourceExtents(target);
    let through = 1;
    for (let axis = 0; axis < 3; axis++)
        if (size[axis] < size[through] - 1e-6)
            through = axis;
    const others = [0, 1, 2].filter((axis) => axis !== through);
    const footprint = (Math.min(size[others[0]], size[others[1]]) * BRUSH_FOOTPRINT) / SHAPE_DIAMETER[shape];
    const length = Math.max(size[through], 1e-3) * BRUSH_THROUGH;
    const { transform } = brush;
    vec3.copy(transform.position, center);
    if (AXIAL_SHAPES.has(shape)) {
        vec3.set(transform.scale, footprint, length, footprint);
        vec3.set(transform.rotation, through === 2 ? 90 : 0, 0, through === 0 ? 90 : 0);
    }
    else {
        const scale = [size[0] * BRUSH_FOOTPRINT, size[1] * BRUSH_FOOTPRINT, size[2] * BRUSH_FOOTPRINT];
        scale[through] = length;
        vec3.set(transform.scale, scale[0], scale[1], scale[2]);
        vec3.set(transform.rotation, 0, 0, 0);
    }
}
export function placeSliceBrush(brush: Entity, target: Entity, axis: Axis, side: AxisSide): void {
    const { center, size } = sourceExtents(target);
    const { transform } = brush;
    const scale = size.map((extent) => extent + 2 * SLICE_MARGIN);
    scale[axis] = size[axis] * 0.5 + SLICE_MARGIN;
    vec3.set(transform.scale, scale[0], scale[1], scale[2]);
    vec3.copy(transform.position, center);
    transform.position[axis] += side * (size[axis] * 0.25 + SLICE_MARGIN * 0.5);
    vec3.set(transform.rotation, 0, 0, 0);
}
export function defaultHollowThickness(target: Entity): number {
    const { size } = sourceExtents(target);
    return Math.max(Math.min(...size) * HOLLOW_THICKNESS_FRACTION, 0.02);
}
export function placeHollowBrush(brush: Entity, target: Entity, thickness: number): void {
    const { center, size } = sourceExtents(target);
    const { transform } = brush;
    for (let axis = 0; axis < 3; axis++) {
        const extent = Math.max(size[axis], 1e-6);
        const factor = Math.max((extent - 2 * thickness) / extent, MIN_HOLLOW_SCALE);
        transform.scale[axis] = factor;
        transform.position[axis] = center[axis] * (1 - factor);
    }
    vec3.set(transform.rotation, 0, 0, 0);
}
export function mirrorBrushTransform(brush: Entity, axis: Axis): void {
    const { position, rotation } = brush.transform;
    position[axis] = -position[axis];
    for (let other = 0; other < 3; other++)
        if (other !== axis)
            rotation[other] = -rotation[other];
}
export function brushExtentAlong(brush: Entity, axis: Axis): number {
    const mesh = brush.mesh;
    if (!mesh)
        return Math.abs(brush.transform.scale[axis]);
    const bounds = getLocalBounds(mesh);
    return (bounds.max[axis] - bounds.min[axis]) * Math.abs(brush.transform.scale[axis]);
}
