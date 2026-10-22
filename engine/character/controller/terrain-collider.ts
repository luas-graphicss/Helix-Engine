import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Scene } from '@/engine/core/scene/scene';
import type { Terrain } from '@/engine/terrain/core/terrain';
interface TerrainPatch {
    readonly terrain: Terrain;
    readonly matrix: Mat4;
    readonly inverse: Mat4;
}
const localPoint = vec3.create();
const worldPoint = vec3.create();
const localNormal = vec3.create();
export class TerrainCollider {
    private readonly patches: TerrainPatch[] = [];
    constructor(scene: Scene) {
        scene.updateWorldMatrices();
        scene.traverse((entity) => {
            if (!entity.terrain || !entity.visible)
                return;
            const inverse = mat4.create();
            if (!mat4.invert(inverse, entity.worldMatrix))
                return;
            this.patches.push({ terrain: entity.terrain, matrix: mat4.copy(mat4.create(), entity.worldMatrix), inverse });
        });
    }
    get isEmpty(): boolean {
        return this.patches.length === 0;
    }
    sample(x: number, z: number, outNormal: Vec3): number | null {
        let best: number | null = null;
        for (const patch of this.patches) {
            vec3.set(worldPoint, x, 0, z);
            mat4.transformPoint(localPoint, patch.inverse, worldPoint);
            const { terrain } = patch;
            if (!terrain.containsLocal(localPoint[0], localPoint[2]))
                continue;
            localPoint[1] = terrain.heightAtLocal(localPoint[0], localPoint[2]);
            mat4.transformPoint(worldPoint, patch.matrix, localPoint);
            if (best !== null && worldPoint[1] <= best)
                continue;
            best = worldPoint[1];
            terrain.normalAtLocal(localNormal, localPoint[0], localPoint[2]);
            mat4.transformDirection(outNormal, patch.matrix, localNormal);
            vec3.normalize(outNormal, outNormal);
        }
        return best;
    }
}
