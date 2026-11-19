import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { InstanceLayout, MODEL_MATRIX_ATTRIBUTES } from '@/engine/renderer/gl/instance-layout';
import type { VisibleMesh, VisibleSet } from '@/engine/renderer/culling/visible-set';
import { byStateThenNearest, byVariantThenNearest, ShaderVariantRegistry } from './batch-order';
import { DynamicBatchSet, fitsDynamicBatch, type DynamicBatch } from './dynamic/dynamic-batch-set';
import { MaterialStateRegistry, type MaterialState } from './material-state';
import { MaterialValueRegistry } from './merged/material-values';
import { StaticBatchSet } from './static/static-batch-set';
export const MESH_INSTANCE_FLOATS = 41;
export const MESH_INSTANCE_LAYOUT = new InstanceLayout([
    ...MODEL_MATRIX_ATTRIBUTES,
    { location: 7, size: 3, offset: 16 },
    { location: 8, size: 3, offset: 19 },
    { location: 9, size: 3, offset: 22 },
    { location: 10, size: 4, offset: 25 },
    { location: 11, size: 4, offset: 29 },
    { location: 12, size: 4, offset: 33 },
    { location: 13, size: 4, offset: 37 },
], MESH_INSTANCE_FLOATS);
const DEFAULT_MATERIAL = createMaterial({ baseColor: vec3.create(0.6, 0.6, 0.6) });
const MESH_ID_SPACE = 1 << 20;
const MAX_DYNAMIC_BATCH_ITEMS = 2;
const IDENTITY_MATRIX = mat4.create();
const IDENTITY_NORMAL_MATRIX = mat3.create();
export type MeshResolver = (visible: VisibleMesh) => MeshData;
export interface BatchingSettings {
    staticBatching: boolean;
    dynamicBatching: boolean;
    shaderBatching: boolean;
}
interface DrawItem {
    visible: VisibleMesh;
    material: Material;
    mesh: MeshData;
    state: MaterialState;
    key: number;
    worldMatrix: Mat4;
    distance: number;
}
export interface MergedInstance {
    readonly material: Material;
    readonly receiveShadows: boolean;
}
export interface MeshBatch {
    mesh: MeshData;
    state: MaterialState;
    firstInstance: number;
    count: number;
    nearest: number;
    variant: number;
    merged: MergedInstance | null;
    readonly items: DrawItem[];
}
export interface MeshBatcherStats {
    instances: number;
    batches: number;
    triangles: number;
    staticBatches: number;
    staticMeshes: number;
    dynamicBatches: number;
    dynamicMeshes: number;
}
function byDistanceAscending(a: DrawItem, b: DrawItem): number {
    return a.distance - b.distance;
}
function byDistanceDescending(a: DrawItem, b: DrawItem): number {
    return b.distance - a.distance;
}
export class MeshBatcher {
    readonly opaque: MeshBatch[] = [];
    readonly transparent: MeshBatch[] = [];
    readonly skinned: MeshBatch[] = [];
    readonly stats: MeshBatcherStats = { instances: 0, batches: 0, triangles: 0, staticBatches: 0, staticMeshes: 0, dynamicBatches: 0, dynamicMeshes: 0 };
    private readonly states = new MaterialStateRegistry();
    private readonly values = new MaterialValueRegistry();
    private readonly variants = new ShaderVariantRegistry();
    private readonly staticBatches = new StaticBatchSet(this.values);
    private readonly dynamicBatches = new DynamicBatchSet<DrawItem>();
    private readonly meshIds = new WeakMap<MeshData, number>();
    private nextMeshId = 1;
    private readonly itemPool: DrawItem[] = [];
    private itemCount = 0;
    private readonly transparentItems: DrawItem[] = [];
    private readonly skinnedItems: DrawItem[] = [];
    private readonly opaqueByKey = new Map<number, MeshBatch>();
    private readonly batchPool: MeshBatch[] = [];
    private batchCount = 0;
    private readonly normalMatrix = mat3.create();
    build(visible: VisibleSet, instances: InstanceBuffer, selection: ReadonlySet<number> | null, resolveMesh: MeshResolver, settings: BatchingSettings): void {
        this.reset();
        instances.begin();
        const staticBatches = this.beginStaticBatches(visible, selection, settings.staticBatching);
        for (const item of visible.meshes) {
            if (!item.virtual)
                this.classify(item, resolveMesh, staticBatches);
        }
        if (settings.dynamicBatching)
            this.mergeSmallBatches(selection);
        for (const batch of this.opaqueByKey.values()) {
            if (batch.items.length === 0)
                continue;
            batch.items.sort(byDistanceAscending);
            batch.nearest = batch.items[0].distance;
            this.opaque.push(batch);
        }
        if (staticBatches)
            this.pushStaticBatches(staticBatches);
        this.opaque.sort(settings.shaderBatching ? byVariantThenNearest : byStateThenNearest);
        for (const batch of this.opaque)
            this.commit(batch, instances, selection);
        if (this.skinnedItems.length > 0) {
            this.skinnedItems.sort(byDistanceAscending);
            for (const item of this.skinnedItems) {
                const batch = this.acquireBatch(item.mesh, item.state);
                batch.items.push(item);
                batch.nearest = item.distance;
                this.skinned.push(batch);
                this.commit(batch, instances, selection);
            }
        }
        if (this.transparentItems.length > 0) {
            this.transparentItems.sort(byDistanceDescending);
            this.groupTransparentRuns();
            for (const batch of this.transparent)
                this.commit(batch, instances, selection);
        }
        instances.upload();
        this.stats.instances = instances.count;
        this.stats.batches = this.opaque.length + this.skinned.length + this.transparent.length;
    }
    private reset(): void {
        const { stats } = this;
        this.opaque.length = 0;
        this.transparent.length = 0;
        this.skinned.length = 0;
        this.transparentItems.length = 0;
        this.skinnedItems.length = 0;
        this.opaqueByKey.clear();
        this.itemCount = 0;
        this.batchCount = 0;
        stats.triangles = 0;
        stats.staticBatches = 0;
        stats.staticMeshes = 0;
        stats.dynamicBatches = 0;
        stats.dynamicMeshes = 0;
    }
    private beginStaticBatches(visible: VisibleSet, selection: ReadonlySet<number> | null, enabled: boolean): StaticBatchSet | null {
        if (!enabled) {
            this.staticBatches.clear();
            return null;
        }
        this.staticBatches.beginView({
            isRenderable: (entity) => visible.isRenderable(entity),
            resolveState: (material) => this.states.resolve(material),
            selection,
            now: performance.now(),
        });
        return this.staticBatches;
    }
    private pushStaticBatches(staticBatches: StaticBatchSet): void {
        for (const chunk of staticBatches.drawn) {
            for (const mesh of chunk.meshes)
                this.pushMerged(mesh, chunk.state, chunk, chunk.nearest);
        }
        staticBatches.endView();
        this.stats.staticBatches = staticBatches.stats.batches;
        this.stats.staticMeshes = staticBatches.stats.meshes;
    }
    private classify(visible: VisibleMesh, resolveMesh: MeshResolver, staticBatches: StaticBatchSet | null): void {
        const material = visible.entity.material ?? DEFAULT_MATERIAL;
        const skinned = visible.entity.skin !== null && visible.mesh.skinning !== undefined;
        const state = this.states.resolve(material);
        if (!skinned && staticBatches?.claim(visible, visible.mesh, material, state))
            return;
        const mesh = skinned ? visible.mesh : resolveMesh(visible);
        const item = this.acquireItem(visible, material, mesh, state);
        if (skinned) {
            this.skinnedItems.push(item);
            return;
        }
        if (state.alphaMode === 'blend') {
            this.transparentItems.push(item);
            return;
        }
        let batch = this.opaqueByKey.get(item.key);
        if (!batch) {
            batch = this.acquireBatch(mesh, state);
            this.opaqueByKey.set(item.key, batch);
        }
        batch.items.push(item);
    }
    private mergeSmallBatches(selection: ReadonlySet<number> | null): void {
        const { dynamicBatches } = this;
        dynamicBatches.begin();
        for (const batch of this.opaqueByKey.values()) {
            const { items } = batch;
            if (items.length > MAX_DYNAMIC_BATCH_ITEMS || batch.state.shader !== null || !fitsDynamicBatch(batch.mesh))
                continue;
            let kept = 0;
            for (const item of items) {
                if (!this.offerToDynamicBatch(item, selection))
                    items[kept++] = item;
            }
            items.length = kept;
        }
        dynamicBatches.flush(this.pushDynamicBatch, this.returnToInstancedBatch);
        this.stats.dynamicBatches = dynamicBatches.stats.batches;
        this.stats.dynamicMeshes = dynamicBatches.stats.meshes;
    }
    private offerToDynamicBatch(item: DrawItem, selection: ReadonlySet<number> | null): boolean {
        const { entity } = item.visible;
        if (selection?.has(entity.id))
            return false;
        return this.dynamicBatches.add(item, item.state, item.material, this.values.resolve(item.material), entity.receiveShadows);
    }
    private readonly pushDynamicBatch = (batch: DynamicBatch): void => {
        this.pushMerged(batch.mesh, batch.state, batch, batch.nearest);
    };
    private readonly returnToInstancedBatch = (item: DrawItem): void => {
        this.opaqueByKey.get(item.key)?.items.push(item);
    };
    private pushMerged(mesh: MeshData, state: MaterialState, merged: MergedInstance, nearest: number): void {
        const batch = this.acquireBatch(mesh, state);
        batch.merged = merged;
        batch.nearest = nearest;
        this.opaque.push(batch);
    }
    private groupTransparentRuns(): void {
        let batch: MeshBatch | null = null;
        for (const item of this.transparentItems) {
            if (!batch || item.key !== batch.items[0].key) {
                batch = this.acquireBatch(item.mesh, item.state);
                this.transparent.push(batch);
            }
            batch.items.push(item);
            if (item.distance < batch.nearest)
                batch.nearest = item.distance;
        }
    }
    private commit(batch: MeshBatch, instances: InstanceBuffer, selection: ReadonlySet<number> | null): void {
        const { merged, items } = batch;
        batch.count = merged ? 1 : items.length;
        batch.firstInstance = instances.allocate(batch.count);
        if (merged) {
            this.writeInstance(instances.data, batch.firstInstance, IDENTITY_MATRIX, IDENTITY_NORMAL_MATRIX, merged.material, merged.receiveShadows, false);
        }
        else {
            for (let i = 0; i < items.length; i++)
                this.writeItem(instances.data, batch.firstInstance + i, items[i], selection);
        }
        this.stats.triangles += (batch.mesh.indices.length / 3) * batch.count;
    }
    private writeItem(data: Float32Array, index: number, item: DrawItem, selection: ReadonlySet<number> | null): void {
        const { entity } = item.visible;
        if (!mat4.normalMatrix(this.normalMatrix, entity.worldMatrix))
            mat3.identity(this.normalMatrix);
        this.writeInstance(data, index, entity.worldMatrix, this.normalMatrix, item.material, entity.receiveShadows, selection !== null && selection.has(entity.id));
    }
    private writeInstance(data: Float32Array, index: number, world: Mat4, normal: Mat3, material: Material, receiveShadows: boolean, selected: boolean): void {
        const offset = index * MESH_INSTANCE_FLOATS;
        data.set(world, offset);
        data.set(normal, offset + 16);
        data[offset + 25] = material.baseColor[0];
        data[offset + 26] = material.baseColor[1];
        data[offset + 27] = material.baseColor[2];
        data[offset + 28] = material.opacity;
        data[offset + 29] = material.roughness;
        data[offset + 30] = material.metallic;
        data[offset + 31] = material.emissiveIntensity;
        data[offset + 32] = receiveShadows ? 1 : 0;
        data[offset + 33] = material.emissive[0];
        data[offset + 34] = material.emissive[1];
        data[offset + 35] = material.emissive[2];
        data[offset + 36] = material.alphaCutoff;
        data[offset + 37] = material.normalScale;
        data[offset + 38] = material.occlusionStrength;
        data[offset + 39] = selected ? 1 : 0;
        data[offset + 40] = material.uvTiling;
    }
    private meshId(mesh: MeshData): number {
        let id = this.meshIds.get(mesh);
        if (id === undefined) {
            id = this.nextMeshId++;
            this.meshIds.set(mesh, id);
        }
        return id;
    }
    private acquireItem(visible: VisibleMesh, material: Material, mesh: MeshData, state: MaterialState): DrawItem {
        const key = state.id * MESH_ID_SPACE + this.meshId(mesh);
        const { worldMatrix } = visible.entity;
        const { distance } = visible;
        let item = this.itemPool[this.itemCount];
        if (!item) {
            item = { visible, material, mesh, state, key, worldMatrix, distance };
            this.itemPool[this.itemCount] = item;
        }
        else {
            item.visible = visible;
            item.material = material;
            item.mesh = mesh;
            item.state = state;
            item.key = key;
            item.worldMatrix = worldMatrix;
            item.distance = distance;
        }
        this.itemCount++;
        return item;
    }
    private acquireBatch(mesh: MeshData, state: MaterialState): MeshBatch {
        let batch = this.batchPool[this.batchCount];
        if (!batch) {
            batch = { mesh, state, firstInstance: 0, count: 0, nearest: Infinity, variant: 0, merged: null, items: [] };
            this.batchPool[this.batchCount] = batch;
        }
        else {
            batch.mesh = mesh;
            batch.state = state;
            batch.firstInstance = 0;
            batch.count = 0;
            batch.nearest = Infinity;
            batch.merged = null;
            batch.items.length = 0;
        }
        batch.variant = this.variants.resolve(state);
        this.batchCount++;
        return batch;
    }
}
