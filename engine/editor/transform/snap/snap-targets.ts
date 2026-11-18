import * as aabb from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import type { Ray } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { getEntityLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { collectSubtrees } from '../selection/transform-targets';
import { isSnapSurface, raycastSurfaces, type SurfaceHit } from './surface-snap';
import { nearestVertexToPointer, type VertexHit } from './vertex-snap';
const CORNER_COUNT = 8;
const corner = vec3.create();
function collectSupports(dragged: readonly Entity[]): number[] {
    const supports: number[] = [];
    for (const entity of dragged) {
        const bounds = getEntityLocalBounds(entity);
        if (!bounds || aabb.isEmpty(bounds))
            continue;
        for (let index = 0; index < CORNER_COUNT; index++) {
            vec3.set(corner, index & 1 ? bounds.max[0] : bounds.min[0], index & 2 ? bounds.max[1] : bounds.min[1], index & 4 ? bounds.max[2] : bounds.min[2]);
            mat4.transformPoint(corner, entity.worldMatrix, corner);
            supports.push(corner[0], corner[1], corner[2]);
        }
    }
    return supports;
}
export class SnapTargets {
    private readonly surfaces: Entity[] = [];
    private readonly supports: readonly number[];
    constructor(scene: Scene, roots: readonly Entity[]) {
        const dragged = collectSubtrees(scene, roots);
        const excluded = new Set(dragged);
        scene.traverseVisible((entity) => {
            if (!excluded.has(entity) && isSnapSurface(entity))
                this.surfaces.push(entity);
        });
        this.supports = collectSupports(dragged);
    }
    vertexNear(out: VertexHit, camera: PerspectiveCamera, pointer: GizmoPointer, ray: Ray): boolean {
        return nearestVertexToPointer(out, this.surfaces, camera, pointer, ray);
    }
    surfaceUnder(out: SurfaceHit, ray: Ray): boolean {
        return raycastSurfaces(out, this.surfaces, ray);
    }
    restDistance(normal: Vec3, from: Vec3): number {
        const { supports } = this;
        if (supports.length === 0)
            return 0;
        let deepest = -Infinity;
        for (let offset = 0; offset < supports.length; offset += 3) {
            const depth = (from[0] - supports[offset]) * normal[0] + (from[1] - supports[offset + 1]) * normal[1] + (from[2] - supports[offset + 2]) * normal[2];
            if (depth > deepest)
                deepest = depth;
        }
        return deepest;
    }
}
