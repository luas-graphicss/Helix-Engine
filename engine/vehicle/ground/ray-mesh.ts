import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { MeshShape } from '@/engine/physics/shapes/collider-shape';
import type { TriangleMeshBvh } from '@/engine/physics/shapes/triangle-mesh-bvh';
const DEGENERATE_DETERMINANT = 1e-12;
class MeshRayQuery {
    private bvh: TriangleMeshBvh | null = null;
    private nearest = 0;
    private found = false;
    private readonly origin = vec3.create();
    private readonly direction = vec3.create();
    private readonly normal = vec3.create();
    private readonly boundsMin = vec3.create();
    private readonly boundsMax = vec3.create();
    private readonly cornerA = vec3.create();
    private readonly cornerB = vec3.create();
    private readonly cornerC = vec3.create();
    private readonly edgeAB = vec3.create();
    private readonly edgeAC = vec3.create();
    private readonly perpendicular = vec3.create();
    private readonly toOrigin = vec3.create();
    private readonly crossed = vec3.create();
    private readonly visit = (triangle: number): void => {
        const { bvh, cornerA, cornerB, cornerC, edgeAB, edgeAC, perpendicular, toOrigin, crossed, origin, direction } = this;
        if (!bvh)
            return;
        bvh.triangle(triangle, cornerA, cornerB, cornerC);
        vec3.subtract(edgeAB, cornerB, cornerA);
        vec3.subtract(edgeAC, cornerC, cornerA);
        vec3.cross(perpendicular, direction, edgeAC);
        const determinant = vec3.dot(edgeAB, perpendicular);
        if (Math.abs(determinant) < DEGENERATE_DETERMINANT)
            return;
        const inverse = 1 / determinant;
        vec3.subtract(toOrigin, origin, cornerA);
        const u = vec3.dot(toOrigin, perpendicular) * inverse;
        if (u < 0 || u > 1)
            return;
        vec3.cross(crossed, toOrigin, edgeAB);
        const v = vec3.dot(direction, crossed) * inverse;
        if (v < 0 || u + v > 1)
            return;
        const distance = vec3.dot(edgeAC, crossed) * inverse;
        if (distance < 0 || distance > this.nearest)
            return;
        this.nearest = distance;
        this.found = true;
        vec3.cross(this.normal, edgeAB, edgeAC);
    };
    cast(shape: MeshShape, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
        const { boundsMin, boundsMax } = this;
        for (let axis = 0; axis < 3; axis++) {
            const end = origin[axis] + direction[axis] * maxDistance;
            boundsMin[axis] = Math.min(origin[axis], end);
            boundsMax[axis] = Math.max(origin[axis], end);
        }
        vec3.copy(this.origin, origin);
        vec3.copy(this.direction, direction);
        this.bvh = shape.bvh;
        this.nearest = maxDistance;
        this.found = false;
        shape.bvh.queryAabb(boundsMin, boundsMax, this.visit);
        this.bvh = null;
        if (!this.found)
            return null;
        vec3.normalize(outNormal, this.normal);
        if (vec3.dot(outNormal, direction) > 0)
            vec3.scale(outNormal, outNormal, -1);
        return this.nearest;
    }
}
const query = new MeshRayQuery();
export function raycastMeshShape(shape: MeshShape, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    return query.cast(shape, origin, direction, maxDistance, outNormal);
}
