import * as aabb from '@/engine/core/math/aabb';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { ShadowCaster } from '@/engine/renderer/culling/visible-set';
import { FloatSnapshot } from '@/engine/renderer/cache/float-snapshot';
export class ShadowCasterSet {
    readonly bounds = aabb.create();
    changed = true;
    private readonly light = new FloatSnapshot(3);
    private readonly previousEntities: Entity[] = [];
    private readonly previousVersions: number[] = [];
    private cursor = 0;
    sync(meshes: readonly ShadowCaster[], terrains: readonly ShadowCaster[], lightDirection: Vec3): boolean {
        const total = meshes.length + terrains.length;
        let changed = this.light.sync(0, lightDirection) || total !== this.previousEntities.length;
        aabb.reset(this.bounds);
        this.cursor = 0;
        changed = this.compare(meshes) || changed;
        changed = this.compare(terrains) || changed;
        this.previousEntities.length = total;
        this.previousVersions.length = total;
        this.changed = changed;
        return total > 0;
    }
    private compare(casters: readonly ShadowCaster[]): boolean {
        const { bounds, previousEntities, previousVersions } = this;
        let changed = false;
        for (const { entity, bounds: casterBounds } of casters) {
            const i = this.cursor++;
            aabb.union(bounds, bounds, casterBounds.aabb);
            if (previousEntities[i] !== entity || previousVersions[i] !== casterBounds.version) {
                previousEntities[i] = entity;
                previousVersions[i] = casterBounds.version;
                changed = true;
            }
        }
        return changed;
    }
}
