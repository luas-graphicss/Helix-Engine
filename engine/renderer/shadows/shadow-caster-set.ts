import * as aabb from '@/engine/core/math/aabb';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { ShadowCaster, ShadowCasterCandidate } from '@/engine/renderer/culling/visible-set';
import { FloatSnapshot } from '@/engine/renderer/cache/float-snapshot';
const SETTLE_FRAMES = 30;
interface CasterHistory {
    version: number;
    changedFrame: number;
}
export class ShadowCasterSet {
    readonly bounds = aabb.create();
    readonly staticCasters: ShadowCasterCandidate[] = [];
    readonly dynamicCasters: ShadowCasterCandidate[] = [];
    lightChanged = true;
    staticChanged = true;
    dynamicChanged = true;
    private readonly light = new FloatSnapshot(3);
    private readonly history = new WeakMap<Entity, CasterHistory>();
    private readonly previousStatic: Entity[] = [];
    private readonly previousStaticVersions: number[] = [];
    private readonly previousDynamic: Entity[] = [];
    private readonly previousDynamicVersions: number[] = [];
    private readonly previousTerrains: Entity[] = [];
    private readonly previousTerrainVersions: number[] = [];
    sync(meshes: readonly ShadowCasterCandidate[], terrains: readonly ShadowCaster[], lightDirection: Vec3, frame: number): boolean {
        const { bounds, staticCasters, dynamicCasters } = this;
        this.lightChanged = this.light.sync(0, lightDirection);
        aabb.reset(bounds);
        staticCasters.length = 0;
        dynamicCasters.length = 0;
        for (const caster of meshes) {
            aabb.union(bounds, bounds, caster.bounds.aabb);
            if (this.isDynamic(caster, frame))
                dynamicCasters.push(caster);
            else
                staticCasters.push(caster);
        }
        for (const caster of terrains)
            aabb.union(bounds, bounds, caster.bounds.aabb);
        const staticChanged = this.compare(staticCasters, this.previousStatic, this.previousStaticVersions);
        const terrainChanged = this.compare(terrains, this.previousTerrains, this.previousTerrainVersions);
        this.staticChanged = staticChanged || terrainChanged;
        this.dynamicChanged = this.compare(dynamicCasters, this.previousDynamic, this.previousDynamicVersions);
        return meshes.length + terrains.length > 0;
    }
    private isDynamic(caster: ShadowCasterCandidate, frame: number): boolean {
        const { entity } = caster;
        if (entity.skin)
            return true;
        const body = entity.rigidBody;
        if (body && body.type !== 'static')
            return true;
        const version = caster.bounds.version;
        let history = this.history.get(entity);
        if (!history) {
            history = { version, changedFrame: -SETTLE_FRAMES };
            this.history.set(entity, history);
            return false;
        }
        if (history.version !== version) {
            history.version = version;
            history.changedFrame = frame;
        }
        return frame - history.changedFrame < SETTLE_FRAMES;
    }
    private compare(casters: readonly ShadowCaster[], previous: Entity[], previousVersions: number[]): boolean {
        let changed = previous.length !== casters.length;
        for (let i = 0; i < casters.length; i++) {
            const { entity, bounds } = casters[i];
            if (previous[i] !== entity || previousVersions[i] !== bounds.version) {
                previous[i] = entity;
                previousVersions[i] = bounds.version;
                changed = true;
            }
        }
        previous.length = casters.length;
        previousVersions.length = casters.length;
        return changed;
    }
}
