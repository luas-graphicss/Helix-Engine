import type { GL } from '@/engine/renderer/gl/context';
import { CLUSTER_BOUNDS_TEXEL, CLUSTER_INFO_TEXEL, CLUSTER_MAX_TRIANGLES, CLUSTER_TEXELS, CLUSTER_TRIANGLES_TEXEL } from '../data/myriad-limits';
import { DataTexture } from './data-texture';
import type { MyriadMeshEntry } from './myriad-mesh-cache';
import { RangeAllocator } from './range-allocator';
const INITIAL_VERTEX_ROWS = 64;
const INITIAL_CLUSTER_ROWS = 4 * CLUSTER_TEXELS;
const TEXEL_UINTS = 4;
export interface GeometryPoolStats {
    vertices: number;
    clusters: number;
    bytes: number;
    meshes: number;
}
export class GeometryPool {
    readonly stats: GeometryPoolStats = { vertices: 0, clusters: 0, bytes: 0, meshes: 0 };
    readonly vertices: DataTexture;
    readonly clusters: DataTexture;
    private readonly vertexAlloc: RangeAllocator;
    private readonly clusterAlloc: RangeAllocator;
    private readonly residents = new Set<MyriadMeshEntry>();
    private readonly maxRows: number;
    private staging = new Uint32Array(0);
    constructor(gl: GL, readonly width: number) {
        this.maxRows = Math.max(1, Math.floor(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number));
        this.vertices = new DataTexture(gl, width, 'rgba32ui', INITIAL_VERTEX_ROWS);
        this.clusters = new DataTexture(gl, width, 'rgba32ui', INITIAL_CLUSTER_ROWS);
        this.vertexAlloc = new RangeAllocator(this.vertices.capacityTexels);
        this.clusterAlloc = new RangeAllocator(this.clusterCapacity);
        this.updateStats();
    }
    private get clusterCapacity(): number {
        return Math.floor(this.clusters.capacityTexels / CLUSTER_TEXELS);
    }
    upload(entry: MyriadMeshEntry): boolean {
        const packed = entry.packed;
        if (!packed)
            return false;
        if (entry.residency)
            return true;
        const vertexBase = this.reserveVertices(packed.vertexCount);
        if (vertexBase < 0)
            return false;
        const clusterBase = this.reserveClusters(packed.clusterCount);
        if (clusterBase < 0) {
            this.vertexAlloc.release(vertexBase, packed.vertexCount);
            return false;
        }
        entry.residency = { vertexBase, vertexCount: packed.vertexCount, clusterBase, clusterCount: packed.clusterCount };
        this.residents.add(entry);
        this.write(entry);
        this.updateStats();
        return true;
    }
    release(entry: MyriadMeshEntry): void {
        const { residency } = entry;
        if (!residency)
            return;
        this.vertexAlloc.release(residency.vertexBase, residency.vertexCount);
        this.clusterAlloc.release(residency.clusterBase, residency.clusterCount);
        this.residents.delete(entry);
        entry.residency = null;
        this.updateStats();
    }
    private reserveVertices(count: number): number {
        let base = this.vertexAlloc.allocate(count);
        while (base < 0) {
            const rows = this.grownRows(this.vertices.rows, this.vertexAlloc.capacity + count);
            if (rows < 0)
                return -1;
            this.vertices.ensureRows(rows);
            this.vertexAlloc.grow(rows * this.width);
            this.reuploadResidents();
            base = this.vertexAlloc.allocate(count);
        }
        return base;
    }
    private reserveClusters(count: number): number {
        let base = this.clusterAlloc.allocate(count);
        while (base < 0) {
            const rows = this.grownRows(this.clusters.rows, (this.clusterAlloc.capacity + count) * CLUSTER_TEXELS);
            if (rows < 0)
                return -1;
            this.clusters.ensureRows(rows);
            this.clusterAlloc.grow(this.clusterCapacity);
            this.reuploadResidents();
            base = this.clusterAlloc.allocate(count);
        }
        return base;
    }
    private grownRows(currentRows: number, neededTexels: number): number {
        const rows = Math.max(currentRows * 2, Math.ceil(neededTexels / this.width));
        return rows > this.maxRows ? -1 : rows;
    }
    private reuploadResidents(): void {
        for (const entry of this.residents)
            this.write(entry);
    }
    private write(entry: MyriadMeshEntry): void {
        const packed = entry.packed;
        const residency = entry.residency;
        if (!packed || !residency)
            return;
        const { vertexBase, clusterBase, clusterCount } = residency;
        this.vertices.upload(vertexBase, packed.vertexCount, packed.vertexData);
        this.clusters.upload(clusterBase * CLUSTER_TEXELS, clusterCount * CLUSTER_TEXELS, this.assembleClusters(packed, vertexBase));
    }
    private assembleClusters(packed: NonNullable<MyriadMeshEntry['packed']>, vertexBase: number): Uint32Array {
        const { clusterCount } = packed;
        const needed = clusterCount * CLUSTER_TEXELS * TEXEL_UINTS;
        if (this.staging.length < needed)
            this.staging = new Uint32Array(needed);
        const texels = this.staging;
        const bounds = new Uint32Array(packed.clusterBounds.buffer, packed.clusterBounds.byteOffset, packed.clusterBounds.length);
        const triangles = triangleWords(packed.triangleData);
        const boundsUints = 2 * TEXEL_UINTS;
        for (let c = 0; c < clusterCount; c++) {
            const base = c * CLUSTER_TEXELS * TEXEL_UINTS;
            const info = base + CLUSTER_INFO_TEXEL * TEXEL_UINTS;
            texels[info] = packed.clusterInfo[c * 4] + vertexBase;
            texels[info + 1] = packed.clusterInfo[c * 4 + 1];
            texels[info + 2] = packed.clusterInfo[c * 4 + 2];
            texels[info + 3] = packed.clusterInfo[c * 4 + 3];
            texels.set(bounds.subarray(c * boundsUints, (c + 1) * boundsUints), base + CLUSTER_BOUNDS_TEXEL * TEXEL_UINTS);
            texels.set(triangles.subarray(c * CLUSTER_MAX_TRIANGLES, (c + 1) * CLUSTER_MAX_TRIANGLES), base + CLUSTER_TRIANGLES_TEXEL * TEXEL_UINTS);
        }
        return texels;
    }
    private updateStats(): void {
        const { stats } = this;
        stats.vertices = this.vertexAlloc.used;
        stats.clusters = this.clusterAlloc.used;
        stats.meshes = this.residents.size;
        stats.bytes = this.vertices.bytes + this.clusters.bytes;
    }
    dispose(): void {
        this.vertices.dispose();
        this.clusters.dispose();
        this.residents.clear();
    }
}
function triangleWords(triangleData: Uint8Array): Uint32Array {
    const words = triangleData.byteLength >> 2;
    if (triangleData.byteOffset % 4 === 0)
        return new Uint32Array(triangleData.buffer, triangleData.byteOffset, words);
    const aligned = new Uint8Array(words * 4);
    aligned.set(triangleData.subarray(0, words * 4));
    return new Uint32Array(aligned.buffer);
}
