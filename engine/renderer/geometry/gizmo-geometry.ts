import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { createBox, createCone, createCylinder, createPlane, createTorus } from './primitives';
import { mergeMeshData, transformMeshData } from './mesh-transform';
import type { MeshData } from './mesh-data';
export const GIZMO_AXIS_START = 0.15;
export const GIZMO_PLANE_MIN = 0.35;
export const GIZMO_PLANE_MAX = 0.6;
export const GIZMO_RING_RADIUS = 1;
export interface GizmoGeometrySet {
    arrow: MeshData;
    scaleHandle: MeshData;
    plane: MeshData;
    ring: MeshData;
    center: MeshData;
}
const ONE = vec3.create(1, 1, 1);
const Y_TO_X = vec3.create(0, 0, -90);
const Y_TO_Z = vec3.create(90, 0, 0);
const placement = mat4.create();
const offset = vec3.create();
function place(mesh: MeshData, rotationDegrees: Vec3, x: number, y = 0, z = 0): MeshData {
    vec3.set(offset, x, y, z);
    mat4.fromTranslationRotationScale(placement, offset, rotationDegrees, ONE);
    return transformMeshData(mesh, placement);
}
export function createGizmoGeometry(): GizmoGeometrySet {
    const shaftRadius = 0.018;
    const arrowShaftLength = 0.8 - GIZMO_AXIS_START;
    const arrow = mergeMeshData('GizmoSeta', [
        place(createCylinder(shaftRadius, arrowShaftLength, 12), Y_TO_X, GIZMO_AXIS_START + arrowShaftLength / 2),
        place(createCone(0.06, 0.2, 16), Y_TO_X, 0.9),
    ]);
    const scaleShaftLength = 0.875 - GIZMO_AXIS_START;
    const scaleHandle = mergeMeshData('GizmoEscala', [
        place(createCylinder(shaftRadius, scaleShaftLength, 12), Y_TO_X, GIZMO_AXIS_START + scaleShaftLength / 2),
        place(createBox(0.12, 0.12, 0.12), Y_TO_X, 0.93),
    ]);
    const planeSize = GIZMO_PLANE_MAX - GIZMO_PLANE_MIN;
    const planeCenter = (GIZMO_PLANE_MIN + GIZMO_PLANE_MAX) / 2;
    const plane = place(createPlane(planeSize, planeSize), Y_TO_Z, planeCenter, planeCenter);
    const ring = place(createTorus(GIZMO_RING_RADIUS, 0.018, 72, 8), Y_TO_X, 0);
    const center = createBox(0.16, 0.16, 0.16);
    return { arrow, scaleHandle, plane, ring, center };
}
