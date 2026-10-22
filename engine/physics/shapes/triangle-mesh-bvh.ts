import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import type { Vec3 } from '@/engine/core/math/vec3';
import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
const LEAF_SIZE = 4;
const MIN_PARTITION_FRACTION = 0.1;
export type TriangleVisitor = (triangle: number) => void;
interface BuildRange {
    node: number;
    start: number;
    count: number;
}
const stack: number[] = [];
export class TriangleMeshBvh {
    readonly positions: Float32Array;
    readonly indices: Uint16Array | Uint32Array;
    readonly triangleCount: number;
    readonly bounds: Aabb = aabb.create();
    private readonly nodeBounds: Float32Array;
    private readonly nodeChildren: Int32Array;
    private readonly order: Int32Array;
    private nodeCount = 0;
    constructor(mesh: MeshData, scale: Vec3) {
        const vertexCount = mesh.positions.length / 3;
        const positions = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i++) {
            positions[i * 3] = mesh.positions[i * 3] * scale[0];
            positions[i * 3 + 1] = mesh.positions[i * 3 + 1] * scale[1];
            positions[i * 3 + 2] = mesh.positions[i * 3 + 2] * scale[2];
        }
        this.positions = positions;
        this.indices = mesh.indices;
        this.triangleCount = mesh.indices.length / 3;
        const maxNodes = Math.max(1, this.triangleCount * 2);
        this.nodeBounds = new Float32Array(maxNodes * 6);
        this.nodeChildren = new Int32Array(maxNodes * 2);
        this.order = new Int32Array(this.triangleCount);
        this.build();
    }
    triangle(index: number, a: Vec3, b: Vec3, c: Vec3): void {
        const { positions, indices } = this;
        const ia = indices[index * 3] * 3;
        const ib = indices[index * 3 + 1] * 3;
        const ic = indices[index * 3 + 2] * 3;
        a[0] = positions[ia];
        a[1] = positions[ia + 1];
        a[2] = positions[ia + 2];
        b[0] = positions[ib];
        b[1] = positions[ib + 1];
        b[2] = positions[ib + 2];
        c[0] = positions[ic];
        c[1] = positions[ic + 1];
        c[2] = positions[ic + 2];
    }
    queryAabb(min: Vec3, max: Vec3, visit: TriangleVisitor): void {
        if (this.triangleCount === 0)
            return;
        const { nodeBounds, nodeChildren, order } = this;
        stack.length = 0;
        stack.push(0);
        while (stack.length > 0) {
            const node = stack.pop() as number;
            const b = node * 6;
            if (nodeBounds[b] > max[0] || nodeBounds[b + 3] < min[0] ||
                nodeBounds[b + 1] > max[1] || nodeBounds[b + 4] < min[1] ||
                nodeBounds[b + 2] > max[2] || nodeBounds[b + 5] < min[2]) {
                continue;
            }
            const first = nodeChildren[node * 2];
            if (first < 0) {
                const start = -first - 1;
                const end = start + nodeChildren[node * 2 + 1];
                for (let i = start; i < end; i++)
                    visit(order[i]);
            }
            else {
                stack.push(first, nodeChildren[node * 2 + 1]);
            }
        }
    }
    private build(): void {
        const { triangleCount, order } = this;
        aabb.reset(this.bounds);
        if (triangleCount === 0) {
            this.nodeCount = 1;
            this.nodeChildren[0] = -1;
            this.nodeChildren[1] = 0;
            return;
        }
        const centroids = new Float32Array(triangleCount * 3);
        const triBounds = new Float32Array(triangleCount * 6);
        const { positions, indices } = this;
        for (let t = 0; t < triangleCount; t++) {
            order[t] = t;
            const b = t * 6;
            triBounds[b] = triBounds[b + 1] = triBounds[b + 2] = Infinity;
            triBounds[b + 3] = triBounds[b + 4] = triBounds[b + 5] = -Infinity;
            for (let k = 0; k < 3; k++) {
                const v = indices[t * 3 + k] * 3;
                for (let axis = 0; axis < 3; axis++) {
                    const value = positions[v + axis];
                    if (value < triBounds[b + axis])
                        triBounds[b + axis] = value;
                    if (value > triBounds[b + 3 + axis])
                        triBounds[b + 3 + axis] = value;
                }
            }
            for (let axis = 0; axis < 3; axis++) {
                centroids[t * 3 + axis] = (triBounds[b + axis] + triBounds[b + 3 + axis]) * 0.5;
                if (triBounds[b + axis] < this.bounds.min[axis])
                    this.bounds.min[axis] = triBounds[b + axis];
                if (triBounds[b + 3 + axis] > this.bounds.max[axis])
                    this.bounds.max[axis] = triBounds[b + 3 + axis];
            }
        }
        this.nodeCount = 1;
        const ranges: BuildRange[] = [{ node: 0, start: 0, count: triangleCount }];
        while (ranges.length > 0) {
            const { node, start, count } = ranges.pop() as BuildRange;
            const nb = node * 6;
            let cminX = Infinity, cminY = Infinity, cminZ = Infinity;
            let cmaxX = -Infinity, cmaxY = -Infinity, cmaxZ = -Infinity;
            this.nodeBounds[nb] = this.nodeBounds[nb + 1] = this.nodeBounds[nb + 2] = Infinity;
            this.nodeBounds[nb + 3] = this.nodeBounds[nb + 4] = this.nodeBounds[nb + 5] = -Infinity;
            for (let i = start; i < start + count; i++) {
                const t = order[i];
                const b = t * 6;
                for (let axis = 0; axis < 3; axis++) {
                    if (triBounds[b + axis] < this.nodeBounds[nb + axis])
                        this.nodeBounds[nb + axis] = triBounds[b + axis];
                    if (triBounds[b + 3 + axis] > this.nodeBounds[nb + 3 + axis])
                        this.nodeBounds[nb + 3 + axis] = triBounds[b + 3 + axis];
                }
                const c = t * 3;
                if (centroids[c] < cminX)
                    cminX = centroids[c];
                if (centroids[c] > cmaxX)
                    cmaxX = centroids[c];
                if (centroids[c + 1] < cminY)
                    cminY = centroids[c + 1];
                if (centroids[c + 1] > cmaxY)
                    cmaxY = centroids[c + 1];
                if (centroids[c + 2] < cminZ)
                    cminZ = centroids[c + 2];
                if (centroids[c + 2] > cmaxZ)
                    cmaxZ = centroids[c + 2];
            }
            if (count <= LEAF_SIZE) {
                this.nodeChildren[node * 2] = -start - 1;
                this.nodeChildren[node * 2 + 1] = count;
                continue;
            }
            const extentX = cmaxX - cminX;
            const extentY = cmaxY - cminY;
            const extentZ = cmaxZ - cminZ;
            const axis = extentX >= extentY && extentX >= extentZ ? 0 : extentY >= extentZ ? 1 : 2;
            const split = axis === 0 ? (cminX + cmaxX) * 0.5 : axis === 1 ? (cminY + cmaxY) * 0.5 : (cminZ + cmaxZ) * 0.5;
            let mid = start;
            for (let i = start; i < start + count; i++) {
                if (centroids[order[i] * 3 + axis] < split) {
                    const swap = order[mid];
                    order[mid] = order[i];
                    order[i] = swap;
                    mid++;
                }
            }
            const leftCount = mid - start;
            if (leftCount < count * MIN_PARTITION_FRACTION || count - leftCount < count * MIN_PARTITION_FRACTION) {
                mid = start + (count >> 1);
            }
            const left = this.nodeCount++;
            const right = this.nodeCount++;
            this.nodeChildren[node * 2] = left;
            this.nodeChildren[node * 2 + 1] = right;
            ranges.push({ node: left, start, count: mid - start }, { node: right, start: mid, count: start + count - mid });
        }
    }
}
interface CacheEntry {
    version: number;
    scale: Float32Array;
    bvh: TriangleMeshBvh;
}
const MAX_SCALES_PER_MESH = 4;
const cache = new WeakMap<MeshData, CacheEntry[]>();
export function getTriangleMeshBvh(mesh: MeshData, scale: Vec3): TriangleMeshBvh {
    const version = getMeshVersion(mesh);
    let entries = cache.get(mesh);
    if (!entries) {
        entries = [];
        cache.set(mesh, entries);
    }
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.version !== version) {
            entries.splice(i, 1);
            continue;
        }
        if (entry.scale[0] === scale[0] && entry.scale[1] === scale[1] && entry.scale[2] === scale[2])
            return entry.bvh;
    }
    const bvh = new TriangleMeshBvh(mesh, scale);
    entries.push({ version, scale: new Float32Array([scale[0], scale[1], scale[2]]), bvh });
    if (entries.length > MAX_SCALES_PER_MESH)
        entries.shift();
    return bvh;
}
