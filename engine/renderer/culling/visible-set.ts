import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { Frustum } from './frustum';
import { RenderableBoundsCache, type RenderableBounds } from './renderable-bounds';
import { SpatialGrid, type SpatialGridStats } from './spatial-grid';
import { pixelsPerTangent, projectedDiameterPixels } from './screen-coverage';
export interface VisibleMesh {
    entity: Entity;
    mesh: MeshData;
    bounds: RenderableBounds;
    distance: number;
    pixelSize: number;
    virtual: boolean;
}
export interface ShadowCaster {
    entity: Entity;
    bounds: RenderableBounds;
}
export interface ShadowCasterCandidate extends ShadowCaster {
    mesh: MeshData;
}
export interface TerrainShadowCaster extends ShadowCaster {
    terrain: Terrain;
}
export interface CullingOptions {
    frustumCulling: boolean;
    minPixelSize: number;
}
export interface CullingStats extends SpatialGridStats {
    candidates: number;
    visible: number;
    frustumCulled: number;
    sizeCulled: number;
}
export function createCullingStats(): CullingStats {
    return { candidates: 0, visible: 0, frustumCulled: 0, sizeCulled: 0, cells: 0, cellsCulled: 0, culledByCell: 0 };
}
export class VisibleSet {
    readonly meshes: VisibleMesh[] = [];
    readonly terrains: Entity[] = [];
    readonly casters: ShadowCasterCandidate[] = [];
    readonly terrainCasters: TerrainShadowCaster[] = [];
    readonly stats = createCullingStats();
    readonly frustum = new Frustum();
    pixelScale = 1;
    private readonly bounds = new RenderableBoundsCache();
    private readonly grid = new SpatialGrid();
    private readonly meshPool: VisibleMesh[] = [];
    private readonly casterPool: ShadowCasterCandidate[] = [];
    private readonly terrainCasterPool: TerrainShadowCaster[] = [];
    private camera: PerspectiveCamera | null = null;
    private options: CullingOptions = { frustumCulling: true, minPixelSize: 0 };
    private showBrushes = true;
    collect(scene: Scene, camera: PerspectiveCamera, viewportHeight: number, options: CullingOptions, showCsgBrushes = true): void {
        const { stats, meshes, terrains, casters, terrainCasters, grid } = this;
        this.camera = camera;
        this.options = options;
        this.showBrushes = showCsgBrushes;
        this.pixelScale = pixelsPerTangent(camera, viewportHeight);
        this.frustum.setFromViewProjection(camera.viewProjectionMatrix);
        meshes.length = 0;
        terrains.length = 0;
        casters.length = 0;
        terrainCasters.length = 0;
        stats.candidates = 0;
        stats.visible = 0;
        stats.frustumCulled = 0;
        stats.sizeCulled = 0;
        grid.beginFrame();
        scene.traverseVisible(this.register);
        grid.forEachCandidate(options.frustumCulling ? this.frustum : null, stats, this.test);
        stats.frustumCulled += stats.culledByCell;
    }
    private readonly register = (entity: Entity): void => {
        const { terrain } = entity;
        if (terrain) {
            const bounds = this.bounds.resolve(entity, terrain.localBounds, terrain.heightVersion);
            if (entity.castShadows)
                this.pushTerrainCaster(entity, terrain, bounds);
            if (!this.options.frustumCulling || this.frustum.intersectsAabb(bounds.aabb))
                this.terrains.push(entity);
            return;
        }
        const mesh = entity.mesh;
        if (!mesh)
            return;
        const brush = entity.csgBrush !== null;
        if (brush && (!this.showBrushes || !(entity.parent?.csg?.showBrushes ?? true)))
            return;
        const { skin } = entity;
        let bounds: RenderableBounds;
        if (skin && mesh.skinning) {
            skin.update(entity);
            bounds = this.bounds.resolve(entity, skin.localBounds, skin.version);
        }
        else {
            bounds = this.bounds.resolve(entity, getLocalBounds(mesh), getMeshVersion(mesh));
        }
        if (entity.castShadows && !brush)
            this.pushCaster(entity, mesh, bounds);
        this.grid.update(entity, bounds);
        this.stats.candidates++;
    };
    private readonly test = (entity: Entity, bounds: RenderableBounds, testIndividually: boolean): void => {
        const { stats, options } = this;
        if (testIndividually && !this.frustum.intersectsAabb(bounds.aabb)) {
            stats.frustumCulled++;
            return;
        }
        const camera = this.camera as PerspectiveCamera;
        const distance = vec3.distance(camera.position, bounds.center);
        const pixelSize = projectedDiameterPixels(bounds.radius, distance, this.pixelScale);
        if (pixelSize < options.minPixelSize) {
            stats.sizeCulled++;
            return;
        }
        this.pushVisible(entity, bounds, distance, pixelSize);
        stats.visible++;
    };
    private pushVisible(entity: Entity, bounds: RenderableBounds, distance: number, pixelSize: number): void {
        const index = this.meshes.length;
        let item = this.meshPool[index];
        if (!item) {
            item = { entity, mesh: entity.mesh as MeshData, bounds, distance, pixelSize, virtual: false };
            this.meshPool[index] = item;
        }
        else {
            item.entity = entity;
            item.mesh = entity.mesh as MeshData;
            item.bounds = bounds;
            item.distance = distance;
            item.pixelSize = pixelSize;
            item.virtual = false;
        }
        this.meshes.push(item);
    }
    private pushCaster(entity: Entity, mesh: MeshData, bounds: RenderableBounds): void {
        const index = this.casters.length;
        let item = this.casterPool[index];
        if (!item) {
            item = { entity, mesh, bounds };
            this.casterPool[index] = item;
        }
        else {
            item.entity = entity;
            item.mesh = mesh;
            item.bounds = bounds;
        }
        this.casters.push(item);
    }
    private pushTerrainCaster(entity: Entity, terrain: Terrain, bounds: RenderableBounds): void {
        const index = this.terrainCasters.length;
        let item = this.terrainCasterPool[index];
        if (!item) {
            item = { entity, terrain, bounds };
            this.terrainCasterPool[index] = item;
        }
        else {
            item.entity = entity;
            item.terrain = terrain;
            item.bounds = bounds;
        }
        this.terrainCasters.push(item);
    }
}
