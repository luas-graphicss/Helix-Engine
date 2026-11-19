import type { Mat4 } from '@/engine/core/math/mat4';
import type { Material } from '@/engine/core/scene/material';
import { getVertexCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { MaterialState } from '../material-state';
import { createMergedMeshData, MergedMeshBuilder, type MergedMeshData } from '../merged/merged-mesh-builder';
const MAX_MESH_VERTICES = 256;
const MAX_GROUP_VERTICES = 0xffff;
const FRAME_VERTEX_BUDGET = 48000;
const MIN_GROUP_SOURCES = 2;
export interface DynamicBatchSource {
    readonly mesh: MeshData;
    readonly worldMatrix: Mat4;
    readonly distance: number;
}
export interface DynamicBatchGroup<TSource extends DynamicBatchSource> {
    readonly state: MaterialState;
    readonly material: Material;
    readonly receiveShadows: boolean;
    readonly sources: TSource[];
    vertices: number;
}
export interface DynamicBatch {
    readonly mesh: MeshData;
    readonly state: MaterialState;
    readonly material: Material;
    readonly receiveShadows: boolean;
    readonly nearest: number;
}
export interface DynamicBatchStats {
    batches: number;
    meshes: number;
}
interface MergedSlot {
    readonly builder: MergedMeshBuilder;
    readonly mesh: MergedMeshData;
}
export function fitsDynamicBatch(mesh: MeshData): boolean {
    return getVertexCount(mesh) <= MAX_MESH_VERTICES;
}
export class DynamicBatchSet<TSource extends DynamicBatchSource> {
    readonly stats: DynamicBatchStats = { batches: 0, meshes: 0 };
    private readonly groups = new Map<string, DynamicBatchGroup<TSource>>();
    private readonly groupPool: DynamicBatchGroup<TSource>[] = [];
    private readonly slots: MergedSlot[] = [];
    private groupCount = 0;
    private slotCount = 0;
    private budget = FRAME_VERTEX_BUDGET;
    begin(): void {
        this.groups.clear();
        this.groupCount = 0;
        this.slotCount = 0;
        this.budget = FRAME_VERTEX_BUDGET;
        this.stats.batches = 0;
        this.stats.meshes = 0;
    }
    add(source: TSource, state: MaterialState, material: Material, materialKey: number, receiveShadows: boolean): boolean {
        const vertices = getVertexCount(source.mesh);
        if (vertices > this.budget)
            return false;
        const key = `${state.id}|${materialKey}|${receiveShadows ? 1 : 0}`;
        let group = this.groups.get(key);
        if (!group || group.vertices + vertices > MAX_GROUP_VERTICES) {
            group = this.acquireGroup(state, material, receiveShadows);
            this.groups.set(key, group);
        }
        group.sources.push(source);
        group.vertices += vertices;
        this.budget -= vertices;
        return true;
    }
    flush(merged: (batch: DynamicBatch) => void, rejected: (source: TSource) => void): void {
        for (let index = 0; index < this.groupCount; index++) {
            const group = this.groupPool[index];
            if (group.sources.length < MIN_GROUP_SOURCES) {
                group.sources.forEach(rejected);
                continue;
            }
            merged(this.merge(group));
        }
    }
    private merge(group: DynamicBatchGroup<TSource>): DynamicBatch {
        const slot = this.acquireSlot();
        let nearest = Infinity;
        slot.builder.reset();
        for (const source of group.sources) {
            slot.builder.append(source.mesh, source.worldMatrix);
            nearest = Math.min(nearest, source.distance);
        }
        slot.builder.viewInto(slot.mesh);
        this.stats.batches++;
        this.stats.meshes += group.sources.length;
        return { mesh: slot.mesh, state: group.state, material: group.material, receiveShadows: group.receiveShadows, nearest };
    }
    private acquireGroup(state: MaterialState, material: Material, receiveShadows: boolean): DynamicBatchGroup<TSource> {
        const group: DynamicBatchGroup<TSource> = { state, material, receiveShadows, sources: this.groupPool[this.groupCount]?.sources ?? [], vertices: 0 };
        group.sources.length = 0;
        this.groupPool[this.groupCount++] = group;
        return group;
    }
    private acquireSlot(): MergedSlot {
        const index = this.slotCount++;
        this.slots[index] ??= { builder: new MergedMeshBuilder(), mesh: createMergedMeshData(`dynamic-batch:${index}`) };
        return this.slots[index];
    }
}
