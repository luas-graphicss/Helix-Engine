import type { Entity } from '@/engine/core/scene/entity';
import type { Material } from '@/engine/core/scene/material';
import { getMeshVersion, getVertexCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { MaterialState } from '../material-state';
import type { MaterialValueRegistry } from '../merged/material-values';
import { createMergedMeshData, MergedMeshBuilder, type MergedMeshData } from '../merged/merged-mesh-builder';
const CELL_SIZE = 32;
const MATRIX_FLOATS = 16;
const MAX_MEMBER_VERTICES = 2048;
const MAX_CHUNK_VERTICES = 0xffff;
const MAX_MEMBERS_SHARING_MESH = 3;
const MIN_BAKED_MEMBERS = 2;
const REBUILD_VERTEX_BUDGET = 60000;
const DEFAULT_SETTLE_MS = 500;
const DEFAULT_EVICT_MS = 250;
const STALE_MEMBER_MS = 10000;
const SWEEP_SPREAD_VIEWS = 256;
type MemberStatus = 'intact' | 'unavailable' | 'changed';
export interface StaticBatchCandidate {
    readonly entity: Entity;
    readonly distance: number;
}
export interface StaticBatchView {
    isRenderable(entity: Entity): boolean;
    resolveState(material: Material): MaterialState;
    readonly selection: ReadonlySet<number> | null;
    readonly now: number;
}
interface Member {
    readonly entity: Entity;
    readonly matrix: Float32Array;
    mesh: MeshData;
    meshVersion: number;
    material: Material;
    materialKey: number;
    settledAt: number;
    seenAt: number;
    chunk: Chunk | null;
    baked: boolean;
}
export interface StaticBatchChunk {
    readonly state: MaterialState;
    readonly receiveShadows: boolean;
    readonly meshes: readonly MeshData[];
    readonly material: Material;
    readonly nearest: number;
}
interface Chunk extends StaticBatchChunk {
    readonly key: string;
    readonly materialKey: number;
    readonly members: Set<Member>;
    readonly meshes: MergedMeshData[];
    material: Material;
    nearest: number;
    represented: number;
    dirty: boolean;
    usable: boolean;
    checkedView: number;
    drawnView: number;
}
export interface StaticBatchStats {
    batches: number;
    meshes: number;
}
function sameMatrix(stored: Float32Array, current: Float32Array): boolean {
    for (let index = 0; index < MATRIX_FLOATS; index++) {
        if (stored[index] !== current[index])
            return false;
    }
    return true;
}
export class StaticBatchSet {
    readonly stats: StaticBatchStats = { batches: 0, meshes: 0 };
    readonly drawn: StaticBatchChunk[] = [];
    private members = new WeakMap<Entity, Member>();
    private readonly chunks = new Map<string, Chunk>();
    private readonly dirty = new Set<Chunk>();
    private readonly builder = new MergedMeshBuilder();
    private view: StaticBatchView | null = null;
    private sweepCursor: Iterator<Chunk> | null = null;
    private viewIndex = 0;
    constructor(private readonly values: MaterialValueRegistry, private readonly settleMs: number = DEFAULT_SETTLE_MS, private readonly evictMs: number = DEFAULT_EVICT_MS) { }
    beginView(view: StaticBatchView): void {
        this.view = view;
        this.viewIndex++;
        this.drawn.length = 0;
        this.stats.batches = 0;
        this.stats.meshes = 0;
    }
    claim(candidate: StaticBatchCandidate, mesh: MeshData, material: Material, state: MaterialState): boolean {
        const view = this.view;
        if (!view)
            return false;
        const { entity } = candidate;
        let member = this.members.get(entity);
        if (entity.material !== material || !this.isEligible(entity, mesh, state)) {
            if (member)
                this.unbake(member);
            return false;
        }
        const materialKey = this.values.resolve(material);
        if (!member) {
            member = { entity, matrix: Float32Array.from(entity.worldMatrix), mesh, meshVersion: getMeshVersion(mesh), material, materialKey, settledAt: view.now, seenAt: view.now, chunk: null, baked: false };
            this.members.set(entity, member);
            return false;
        }
        member.seenAt = view.now;
        if (member.materialKey !== materialKey || this.hasChanged(member, mesh, material)) {
            this.unbake(member);
            member.matrix.set(entity.worldMatrix);
            member.mesh = mesh;
            member.meshVersion = getMeshVersion(mesh);
            member.material = material;
            member.materialKey = materialKey;
            member.settledAt = view.now;
            return false;
        }
        const { chunk } = member;
        if (!chunk) {
            if (view.now - member.settledAt >= this.settleMs)
                this.join(member, state, materialKey);
            return false;
        }
        if (chunk.state !== state || chunk.receiveShadows !== entity.receiveShadows) {
            this.unbake(member);
            return false;
        }
        if (!member.baked || !this.isUsable(chunk, view))
            return false;
        if (chunk.drawnView !== this.viewIndex) {
            chunk.drawnView = this.viewIndex;
            chunk.nearest = Infinity;
            chunk.represented = 0;
            this.drawn.push(chunk);
            this.stats.batches += chunk.meshes.length;
        }
        chunk.nearest = Math.min(chunk.nearest, candidate.distance);
        chunk.represented++;
        this.stats.meshes++;
        return true;
    }
    clear(): void {
        if (this.chunks.size === 0)
            return;
        this.members = new WeakMap();
        this.chunks.clear();
        this.dirty.clear();
        this.drawn.length = 0;
        this.sweepCursor = null;
    }
    endView(): void {
        this.releaseStaleMembers();
        let budget = REBUILD_VERTEX_BUDGET;
        for (const chunk of this.dirty) {
            if (budget <= 0)
                break;
            this.dirty.delete(chunk);
            if (chunk.members.size === 0) {
                this.chunks.delete(chunk.key);
                continue;
            }
            budget -= this.rebuild(chunk);
        }
    }
    private releaseStaleMembers(): void {
        const { view } = this;
        if (!view)
            return;
        const chunksPerView = Math.max(1, Math.ceil(this.chunks.size / SWEEP_SPREAD_VIEWS));
        for (let swept = 0; swept < chunksPerView; swept++) {
            this.sweepCursor ??= this.chunks.values();
            const next = this.sweepCursor.next();
            if (next.done) {
                this.sweepCursor = null;
                return;
            }
            for (const member of next.value.members) {
                if (view.isRenderable(member.entity))
                    member.seenAt = view.now;
                else if (view.now - member.seenAt > STALE_MEMBER_MS)
                    this.unbake(member);
            }
        }
    }
    private isEligible(entity: Entity, mesh: MeshData, state: MaterialState): boolean {
        if (state.alphaMode === 'blend' || state.shader !== null || entity.skin !== null || entity.csgBrush !== null)
            return false;
        return getVertexCount(mesh) <= MAX_MEMBER_VERTICES;
    }
    private hasChanged(member: Member, mesh: MeshData, material: Material): boolean {
        return member.mesh !== mesh || member.meshVersion !== getMeshVersion(mesh) || member.material !== material || !sameMatrix(member.matrix, member.entity.worldMatrix);
    }
    private join(member: Member, state: MaterialState, materialKey: number): void {
        const { entity, matrix } = member;
        const key = `${state.id}|${materialKey}|${entity.receiveShadows ? 1 : 0}|${Math.floor(matrix[12] / CELL_SIZE)}|${Math.floor(matrix[14] / CELL_SIZE)}`;
        let chunk = this.chunks.get(key);
        if (!chunk) {
            chunk = { key, state, materialKey, receiveShadows: entity.receiveShadows, members: new Set(), meshes: [], material: member.material, nearest: Infinity, represented: 0, dirty: false, usable: false, checkedView: 0, drawnView: 0 };
            this.chunks.set(key, chunk);
        }
        chunk.members.add(member);
        member.chunk = chunk;
        this.markDirty(chunk);
    }
    private unbake(member: Member): void {
        member.baked = false;
        const { chunk } = member;
        if (!chunk)
            return;
        chunk.members.delete(member);
        member.chunk = null;
        this.markDirty(chunk);
    }
    private markDirty(chunk: Chunk): void {
        chunk.dirty = true;
        this.dirty.add(chunk);
    }
    private isUsable(chunk: Chunk, view: StaticBatchView): boolean {
        if (chunk.checkedView === this.viewIndex)
            return chunk.usable;
        chunk.checkedView = this.viewIndex;
        chunk.usable = !chunk.dirty && chunk.meshes.length > 0;
        if (!chunk.usable)
            return false;
        for (const member of chunk.members) {
            if (!member.baked)
                continue;
            const status = this.inspect(member, chunk, view);
            if (status === 'changed')
                this.unbake(member);
            if (status !== 'intact')
                chunk.usable = false;
        }
        return chunk.usable;
    }
    private inspect(member: Member, chunk: Chunk, view: StaticBatchView): MemberStatus {
        const { entity } = member;
        const material = entity.material;
        if (material !== member.material || entity.mesh !== member.mesh || member.meshVersion !== getMeshVersion(member.mesh))
            return 'changed';
        if (entity.receiveShadows !== chunk.receiveShadows || !sameMatrix(member.matrix, entity.worldMatrix))
            return 'changed';
        if (this.values.resolve(material) !== chunk.materialKey || view.resolveState(material) !== chunk.state)
            return 'changed';
        if (!view.isRenderable(entity))
            return view.now - member.seenAt > this.evictMs ? 'changed' : 'unavailable';
        member.seenAt = view.now;
        return view.selection?.has(entity.id) ? 'unavailable' : 'intact';
    }
    private rebuild(chunk: Chunk): number {
        const usage = new Map<MeshData, number>();
        for (const member of chunk.members)
            usage.set(member.mesh, (usage.get(member.mesh) ?? 0) + 1);
        const bakeable: Member[] = [];
        for (const member of chunk.members) {
            member.baked = false;
            if ((usage.get(member.mesh) ?? 0) <= MAX_MEMBERS_SHARING_MESH)
                bakeable.push(member);
        }
        chunk.dirty = false;
        chunk.checkedView = 0;
        if (bakeable.length < MIN_BAKED_MEMBERS) {
            chunk.meshes.length = 0;
            return 0;
        }
        const { builder } = this;
        let vertices = 0;
        let used = 0;
        builder.reset();
        for (const member of bakeable) {
            if (builder.vertexCount + getVertexCount(member.mesh) > MAX_CHUNK_VERTICES)
                used = this.flush(chunk, used);
            builder.append(member.mesh, member.matrix);
            member.baked = true;
            vertices += getVertexCount(member.mesh);
        }
        chunk.meshes.length = this.flush(chunk, used);
        chunk.material = bakeable[0].material;
        return vertices;
    }
    private flush(chunk: Chunk, used: number): number {
        const { builder } = this;
        if (builder.vertexCount === 0)
            return used;
        chunk.meshes[used] ??= createMergedMeshData(`static-batch:${chunk.key}:${used}`);
        builder.writeTo(chunk.meshes[used]);
        builder.reset();
        return used + 1;
    }
}
