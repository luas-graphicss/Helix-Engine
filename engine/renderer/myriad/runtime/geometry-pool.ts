import type { GL } from '@/engine/renderer/gl/context';
import { CLUSTER_MAX_TRIANGLES } from '../data/myriad-limits';
import { DataTexture } from './data-texture';
import type { MyriadMeshEntry } from './myriad-mesh-cache';
import { RangeAllocator } from './range-allocator';
const INITIAL_VERTEX_ROWS = 64;
const INITIAL_CLUSTER_ROWS = 4;
export const BOUNDS_TEXELS_PER_CLUSTER = 2;
export interface GeometryPoolStats {
    vertices: number;
    clusters: number;
    bytes: number;
    meshes: number;
}
export class GeometryPool {
    readonly stats: GeometryPoolStats = { vertices: 0, clusters: 0, bytes: 0, meshes: 0 };
    readonly vertices: DataTexture;
    readonly triangles: DataTexture;
    readonly clusterInfo: DataTexture;
    readonly clusterBounds: DataTexture;
    private readonly vertexAlloc: RangeAllocator;
    private readonly clusterAlloc: RangeAllocator;
    private readonly residents = new Set<MyriadMeshEntry>();
    private readonly maxRows: number;
    constructor(gl: GL, readonly width: number) {
        this.maxRows = Math.max(1, Math.floor(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number));
        this.vertices = new DataTexture(gl, width, 'rgba32ui', INITIAL_VERTEX_ROWS);
        this.triangles = new DataTexture(gl, width, 'rgba8ui', INITIAL_CLUSTER_ROWS * CLUSTER_MAX_TRIANGLES);
        this.clusterInfo = new DataTexture(gl, width, 'rgba32ui', INITIAL_CLUSTER_ROWS);
        this.clusterBounds = new DataTexture(gl, width, 'rgba32f', INITIAL_CLUSTER_ROWS * BOUNDS_TEXELS_PER_CLUSTER);
        this.vertexAlloc = new RangeAllocator(this.vertices.capacityTexels);
        this.clusterAlloc = new RangeAllocator(this.clusterInfo.capacityTexels);
        this.updateStats();
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
            const rows = this.grownRows(this.clusterInfo.rows, this.clusterAlloc.capacity + count);
            if (rows < 0 || rows * CLUSTER_MAX_TRIANGLES > this.maxRows)
                return -1;
            this.clusterInfo.ensureRows(rows);
            this.triangles.ensureRows(rows * CLUSTER_MAX_TRIANGLES);
            this.clusterBounds.ensureRows(rows * BOUNDS_TEXELS_PER_CLUSTER);
            this.clusterAlloc.grow(rows * this.width);
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
        this.triangles.upload(clusterBase * CLUSTER_MAX_TRIANGLES, clusterCount * CLUSTER_MAX_TRIANGLES, packed.triangleData);
        this.clusterBounds.upload(clusterBase * BOUNDS_TEXELS_PER_CLUSTER, clusterCount * BOUNDS_TEXELS_PER_CLUSTER, packed.clusterBounds);
        const info = packed.clusterInfo.slice();
        for (let c = 0; c < clusterCount; c++)
            info[c * 4] += vertexBase;
        this.clusterInfo.upload(clusterBase, clusterCount, info);
    }
    private updateStats(): void {
        const { stats } = this;
        stats.vertices = this.vertexAlloc.used;
        stats.clusters = this.clusterAlloc.used;
        stats.meshes = this.residents.size;
        stats.bytes = this.vertices.bytes + this.triangles.bytes + this.clusterInfo.bytes + this.clusterBounds.bytes;
    }
    dispose(): void {
        this.vertices.dispose();
        this.triangles.dispose();
        this.clusterInfo.dispose();
        this.clusterBounds.dispose();
        this.residents.clear();
    }
}
