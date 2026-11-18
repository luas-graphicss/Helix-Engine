import * as aabb from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import type { Ray } from '@/engine/core/math/ray';
import { degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createScreenPoint, projectToScreen } from '@/engine/editor/viewport/screen-space';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
export interface VertexHit {
    readonly point: Vec3;
    entity: Entity | null;
    index: number;
}
const SNAP_RADIUS_PX = 14;
const sphereCenter = vec3.create();
const screen = createScreenPoint();
export function createVertexHit(): VertexHit {
    return { point: vec3.create(), entity: null, index: -1 };
}
export function vertexWorldPosition(out: Vec3, entity: Entity, index: number): Vec3 | null {
    const positions = entity.mesh?.positions;
    const offset = index * 3;
    if (!positions || index < 0 || offset + 2 >= positions.length)
        return null;
    vec3.set(out, positions[offset], positions[offset + 1], positions[offset + 2]);
    return mat4.transformPoint(out, entity.worldMatrix, out);
}
function pointerTolerance(camera: PerspectiveCamera, pointer: GizmoPointer): number {
    const focalLength = pointer.height / (2 * Math.tan(degToRad(camera.fovDegrees) / 2));
    return SNAP_RADIUS_PX / focalLength;
}
function mayReachRay(entity: Entity, mesh: MeshData, ray: Ray, tolerance: number): boolean {
    const bounds = getLocalBounds(mesh);
    mat4.transformPoint(sphereCenter, entity.worldMatrix, aabb.center(sphereCenter, bounds));
    const radius = aabb.halfDiagonal(bounds) * mat4.maxAxisScale(entity.worldMatrix);
    vec3.subtract(sphereCenter, sphereCenter, ray.origin);
    const along = vec3.dot(sphereCenter, ray.direction);
    const offAxis = Math.sqrt(Math.max(vec3.dot(sphereCenter, sphereCenter) - along * along, 0));
    return offAxis - radius <= Math.max(along + radius, 0) * tolerance;
}
export function nearestVertexToPointer(out: VertexHit, entities: readonly Entity[], camera: PerspectiveCamera, pointer: GizmoPointer, ray: Ray): boolean {
    const tolerance = pointerTolerance(camera, pointer);
    const ox = ray.origin[0], oy = ray.origin[1], oz = ray.origin[2];
    const dx = ray.direction[0], dy = ray.direction[1], dz = ray.direction[2];
    let narrowest = Infinity;
    out.entity = null;
    out.index = -1;
    for (const entity of entities) {
        const mesh = entity.mesh;
        if (!mesh || entity.skin || !mayReachRay(entity, mesh, ray, tolerance))
            continue;
        const m = entity.worldMatrix;
        const { positions } = mesh;
        for (let offset = 0; offset < positions.length; offset += 3) {
            const x = positions[offset], y = positions[offset + 1], z = positions[offset + 2];
            const rx = m[0] * x + m[4] * y + m[8] * z + m[12] - ox;
            const ry = m[1] * x + m[5] * y + m[9] * z + m[13] - oy;
            const rz = m[2] * x + m[6] * y + m[10] * z + m[14] - oz;
            const along = rx * dx + ry * dy + rz * dz;
            if (along <= 0)
                continue;
            const spread = (rx * rx + ry * ry + rz * rz - along * along) / (along * along);
            if (spread >= narrowest)
                continue;
            narrowest = spread;
            vec3.set(out.point, rx + ox, ry + oy, rz + oz);
            out.entity = entity;
            out.index = offset / 3;
        }
    }
    if (!out.entity || !projectToScreen(screen, camera.viewProjectionMatrix, out.point, pointer.width, pointer.height))
        return false;
    return Math.hypot(screen[0] - pointer.x, screen[1] - pointer.y) <= SNAP_RADIUS_PX;
}
