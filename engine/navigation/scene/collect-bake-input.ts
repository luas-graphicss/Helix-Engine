import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { NOT_WALKABLE_AREA } from '../areas/nav-areas';
import type { NavBakeInput } from '../bake/bake-nav-mesh';
import type { NavAreaVolume } from '../bake/filter-cells';
import type { NavHeightSource } from '../bake/rasterize-height-source';
import { TriangleSoupBuilder } from '../bake/triangle-soup';
import { NULL_AREA } from '../mesh/nav-cells';
import type { NavModifierSettings } from '../modifier/nav-modifier-settings';
import type { NavSurfaceSettings } from '../surface/nav-surface-settings';
export interface WorldBox {
    readonly min: Vec3;
    readonly max: Vec3;
}
const BOX_CORNERS = 8;
const localCorner = vec3.create();
const worldCorner = vec3.create();
export function worldBoxBounds(world: Mat4, center: Vec3, size: Vec3): WorldBox {
    const min = vec3.create(Infinity, Infinity, Infinity);
    const max = vec3.create(-Infinity, -Infinity, -Infinity);
    for (let corner = 0; corner < BOX_CORNERS; corner++) {
        for (let axis = 0; axis < 3; axis++)
            localCorner[axis] = center[axis] + ((corner >> axis) & 1 ? 0.5 : -0.5) * size[axis];
        mat4.transformPoint(worldCorner, world, localCorner);
        for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], worldCorner[axis]);
            max[axis] = Math.max(max[axis], worldCorner[axis]);
        }
    }
    return { min, max };
}
function createAreaVolume(entity: Entity, modifier: NavModifierSettings): NavAreaVolume | null {
    const inverseWorld = mat4.create();
    if (!mat4.invert(inverseWorld, entity.worldMatrix))
        return null;
    const { min, max } = worldBoxBounds(entity.worldMatrix, modifier.center, modifier.size);
    return { inverseWorld, center: modifier.center, halfSize: vec3.scale(vec3.create(), modifier.size, 0.5), minX: min[0], maxX: max[0], minZ: min[2], maxZ: max[2], area: modifier.area };
}
function createTerrainSource(entity: Entity, terrain: Terrain, area: number): NavHeightSource {
    const originX = entity.worldMatrix[12];
    const originY = entity.worldMatrix[13];
    const originZ = entity.worldMatrix[14];
    const half = terrain.halfSize;
    const normal = vec3.create();
    return {
        minX: originX - half,
        maxX: originX + half,
        minZ: originZ - half,
        maxZ: originZ + half,
        area,
        heightAt: (x, z) => terrain.heightAtLocal(x - originX, z - originZ) + originY,
        normalYAt: (x, z) => terrain.normalAtLocal(normal, x - originX, z - originZ)[1],
    };
}
function movesAtRuntime(entity: Entity): boolean {
    const hasMovingBody = entity.rigidBody !== null && entity.rigidBody.type !== 'static';
    return hasMovingBody || entity.navAgent !== null || entity.navObstacle !== null || entity.vehicle !== null || entity.wheel !== null || entity.character !== null || entity.cloth !== null;
}
function bakedArea(area: number): number {
    return area === NOT_WALKABLE_AREA ? NULL_AREA : area;
}
class BakeCollector {
    readonly soup = new TriangleSoupBuilder();
    readonly heightSources: NavHeightSource[] = [];
    readonly areaVolumes: NavAreaVolume[] = [];
    collectGeometry(entity: Entity, inheritedArea: number): void {
        const modifier = entity.navModifier;
        if (!entity.visible || movesAtRuntime(entity) || modifier?.mode === 'ignore')
            return;
        const area = modifier?.mode === 'area' ? modifier.area : inheritedArea;
        const { mesh } = entity;
        if (entity.terrain)
            this.heightSources.push(createTerrainSource(entity, entity.terrain, bakedArea(area)));
        else if (mesh && !mesh.dynamic && !entity.skin && !entity.csgBrush && modifier?.mode !== 'volume')
            this.soup.addMesh(mesh, entity.worldMatrix, bakedArea(area));
        for (const child of entity.children)
            this.collectGeometry(child, area);
    }
    collectVolumes(scene: Scene): void {
        for (const entity of scene.entities) {
            const modifier = entity.navModifier;
            const volume = modifier?.mode === 'volume' && entity.visible ? createAreaVolume(entity, modifier) : null;
            if (volume)
                this.areaVolumes.push(volume);
        }
    }
    geometryBounds(): WorldBox {
        const min = vec3.copy(vec3.create(), this.soup.min);
        const max = vec3.copy(vec3.create(), this.soup.max);
        for (const source of this.heightSources) {
            min[0] = Math.min(min[0], source.minX);
            min[2] = Math.min(min[2], source.minZ);
            max[0] = Math.max(max[0], source.maxX);
            max[2] = Math.max(max[2], source.maxZ);
        }
        return { min, max };
    }
}
export function collectBakeInput(scene: Scene, surface: Entity | null, settings: NavSurfaceSettings): NavBakeInput {
    const collector = new BakeCollector();
    const bakesChildrenOnly = settings.collect === 'children' && surface !== null;
    collector.collectGeometry(bakesChildrenOnly ? surface : scene.root, settings.defaultArea);
    collector.collectVolumes(scene);
    const isBoxed = settings.collect === 'volume' && surface !== null;
    const { min, max } = isBoxed ? worldBoxBounds(surface.worldMatrix, settings.volumeCenter, settings.volumeSize) : collector.geometryBounds();
    return {
        triangles: collector.soup,
        heightSources: collector.heightSources,
        areaVolumes: collector.areaVolumes,
        minX: min[0],
        maxX: max[0],
        minZ: min[2],
        maxZ: max[2],
        minHeight: isBoxed ? min[1] : -Infinity,
        maxHeight: isBoxed ? max[1] : Infinity,
    };
}
