import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { InstanceLayout, MODEL_MATRIX_ATTRIBUTES } from '@/engine/renderer/gl/instance-layout';
import type { VisibleMesh, VisibleSet } from '@/engine/renderer/culling/visible-set';
import { MaterialStateRegistry, type MaterialState } from './material-state';
export const MESH_INSTANCE_FLOATS = 40;
export const MESH_INSTANCE_LAYOUT = new InstanceLayout([
    ...MODEL_MATRIX_ATTRIBUTES,
    { location: 7, size: 3, offset: 16 },
    { location: 8, size: 3, offset: 19 },
    { location: 9, size: 3, offset: 22 },
    { location: 10, size: 4, offset: 25 },
    { location: 11, size: 4, offset: 29 },
    { location: 12, size: 4, offset: 33 },
    { location: 13, size: 3, offset: 37 },
], MESH_INSTANCE_FLOATS);
const DEFAULT_MATERIAL = createMaterial({ baseColor: vec3.create(0.6, 0.6, 0.6) });
const MESH_ID_SPACE = 1 << 20;
export type MeshResolver = (visible: VisibleMesh) => MeshData;
interface DrawItem {
    visible: VisibleMesh;
    material: Material;
    mesh: MeshData;
    state: MaterialState;
    key: number;
}
export interface MeshBatch {
    mesh: MeshData;
    state: MaterialState;
    firstInstance: number;
    count: number;
    nearest: number;
    readonly items: DrawItem[];
}
export interface MeshBatcherStats {
    instances: number;
    batches: number;
    triangles: number;
}
function byDistanceAscending(a: DrawItem, b: DrawItem): number {
    return a.visible.distance - b.visible.distance;
}
function byDistanceDescending(a: DrawItem, b: DrawItem): number {
    return b.visible.distance - a.visible.distance;
}
function byStateThenNearest(a: MeshBatch, b: MeshBatch): number {
    return a.state.id - b.state.id || a.nearest - b.nearest;
}
export class MeshBatcher {
    readonly opaque: MeshBatch[] = [];
    readonly transparent: MeshBatch[] = [];
    readonly stats: MeshBatcherStats = { instances: 0, batches: 0, triangles: 0 };
    private readonly states = new MaterialStateRegistry();
    private readonly meshIds = new WeakMap<MeshData, number>();
    private nextMeshId = 1;
    private readonly itemPool: DrawItem[] = [];
    private itemCount = 0;
    private readonly transparentItems: DrawItem[] = [];
    private readonly opaqueByKey = new Map<number, MeshBatch>();
    private readonly batchPool: MeshBatch[] = [];
    private batchCount = 0;
    private readonly normalMatrix = mat3.create();
    build(visible: VisibleSet, instances: InstanceBuffer, selectedId: number | null, resolveMesh: MeshResolver): void {
        this.reset();
        instances.begin();
        for (const item of visible.meshes)
            this.classify(item, resolveMesh);
        for (const batch of this.opaqueByKey.values()) {
            batch.items.sort(byDistanceAscending);
            this.opaque.push(batch);
        }
        this.opaque.sort(byStateThenNearest);
        for (const batch of this.opaque)
            this.commit(batch, instances, selectedId);
        if (this.transparentItems.length > 0) {
            this.transparentItems.sort(byDistanceDescending);
            this.groupTransparentRuns();
            for (const batch of this.transparent)
                this.commit(batch, instances, selectedId);
        }
        instances.upload();
        this.stats.instances = instances.count;
        this.stats.batches = this.opaque.length + this.transparent.length;
    }
    private reset(): void {
        this.opaque.length = 0;
        this.transparent.length = 0;
        this.transparentItems.length = 0;
        this.opaqueByKey.clear();
        this.itemCount = 0;
        this.batchCount = 0;
        this.stats.triangles = 0;
    }
    private classify(visible: VisibleMesh, resolveMesh: MeshResolver): void {
        const material = visible.entity.material ?? DEFAULT_MATERIAL;
        const mesh = resolveMesh(visible);
        const state = this.states.resolve(material);
        const item = this.acquireItem(visible, material, mesh, state);
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
        if (visible.distance < batch.nearest)
            batch.nearest = visible.distance;
    }
    private groupTransparentRuns(): void {
        let batch: MeshBatch | null = null;
        for (const item of this.transparentItems) {
            if (!batch || item.key !== batch.items[0].key) {
                batch = this.acquireBatch(item.mesh, item.state);
                this.transparent.push(batch);
            }
            batch.items.push(item);
            if (item.visible.distance < batch.nearest)
                batch.nearest = item.visible.distance;
        }
    }
    private commit(batch: MeshBatch, instances: InstanceBuffer, selectedId: number | null): void {
        batch.count = batch.items.length;
        batch.firstInstance = instances.allocate(batch.count);
        const trianglesPerInstance = batch.mesh.indices.length / 3;
        for (let i = 0; i < batch.items.length; i++) {
            this.writeInstance(instances.data, batch.firstInstance + i, batch.items[i], selectedId);
        }
        this.stats.triangles += trianglesPerInstance * batch.count;
    }
    private writeInstance(data: Float32Array, index: number, item: DrawItem, selectedId: number | null): void {
        const { entity } = item.visible;
        const material = item.material;
        const offset = index * MESH_INSTANCE_FLOATS;
        data.set(entity.worldMatrix, offset);
        if (!mat4.normalMatrix(this.normalMatrix, entity.worldMatrix))
            mat3.identity(this.normalMatrix);
        data.set(this.normalMatrix, offset + 16);
        data[offset + 25] = material.baseColor[0];
        data[offset + 26] = material.baseColor[1];
        data[offset + 27] = material.baseColor[2];
        data[offset + 28] = material.opacity;
        data[offset + 29] = material.roughness;
        data[offset + 30] = material.metallic;
        data[offset + 31] = material.emissiveIntensity;
        data[offset + 32] = entity.receiveShadows ? 1 : 0;
        data[offset + 33] = material.emissive[0];
        data[offset + 34] = material.emissive[1];
        data[offset + 35] = material.emissive[2];
        data[offset + 36] = material.alphaCutoff;
        data[offset + 37] = material.normalScale;
        data[offset + 38] = material.occlusionStrength;
        data[offset + 39] = entity.id === selectedId ? 1 : 0;
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
        let item = this.itemPool[this.itemCount];
        if (!item) {
            item = { visible, material, mesh, state, key };
            this.itemPool[this.itemCount] = item;
        }
        else {
            item.visible = visible;
            item.material = material;
            item.mesh = mesh;
            item.state = state;
            item.key = key;
        }
        this.itemCount++;
        return item;
    }
    private acquireBatch(mesh: MeshData, state: MaterialState): MeshBatch {
        let batch = this.batchPool[this.batchCount];
        if (!batch) {
            batch = { mesh, state, firstInstance: 0, count: 0, nearest: Infinity, items: [] };
            this.batchPool[this.batchCount] = batch;
        }
        else {
            batch.mesh = mesh;
            batch.state = state;
            batch.firstInstance = 0;
            batch.count = 0;
            batch.nearest = Infinity;
            batch.items.length = 0;
        }
        this.batchCount++;
        return batch;
    }
}
