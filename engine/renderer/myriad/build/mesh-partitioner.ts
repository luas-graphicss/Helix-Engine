function computeCentroids(positions: Float32Array, indices: Uint32Array, triangleIds: Uint32Array): Float32Array {
    const centroids = new Float32Array(triangleIds.length * 3);
    for (let i = 0; i < triangleIds.length; i++) {
        const t = triangleIds[i] * 3;
        const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
        centroids[i * 3] = (positions[a] + positions[b] + positions[c]) / 3;
        centroids[i * 3 + 1] = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
        centroids[i * 3 + 2] = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
    }
    return centroids;
}
function swap(order: Uint32Array, i: number, j: number): void {
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
}
function nthElement(order: Uint32Array, centroids: Float32Array, axis: number, lo: number, hi: number, k: number): void {
    let left = lo;
    let right = hi - 1;
    while (left < right) {
        const pivot = centroids[order[(left + right) >>> 1] * 3 + axis];
        let i = left;
        let j = right;
        while (i <= j) {
            while (centroids[order[i] * 3 + axis] < pivot)
                i++;
            while (centroids[order[j] * 3 + axis] > pivot)
                j--;
            if (i <= j) {
                swap(order, i, j);
                i++;
                j--;
            }
        }
        if (k <= j)
            right = j;
        else if (k >= i)
            left = i;
        else
            return;
    }
}
export class TrianglePartitioner {
    private readonly stamps: Int32Array;
    private stamp = 0;
    constructor(vertexCount: number) {
        this.stamps = new Int32Array(vertexCount);
    }
    partition(positions: Float32Array, indices: Uint32Array, triangleIds: Uint32Array | null, maxTriangles: number, maxVertices: number): Uint32Array[] {
        const ids = triangleIds ?? sequence(indices.length / 3);
        if (ids.length === 0)
            return [];
        const centroids = computeCentroids(positions, indices, ids);
        const order = sequence(ids.length);
        const clusters: Uint32Array[] = [];
        this.split(order, centroids, ids, indices, 0, ids.length, maxTriangles, maxVertices, clusters);
        return clusters;
    }
    private split(order: Uint32Array, centroids: Float32Array, ids: Uint32Array, indices: Uint32Array, lo: number, hi: number, maxTriangles: number, maxVertices: number, clusters: Uint32Array[]): void {
        const count = hi - lo;
        if (count <= maxTriangles && (count === 1 || this.countVertices(order, ids, indices, lo, hi) <= maxVertices)) {
            const cluster = new Uint32Array(count);
            for (let i = 0; i < count; i++)
                cluster[i] = ids[order[lo + i]];
            clusters.push(cluster);
            return;
        }
        const axis = this.longestAxis(order, centroids, lo, hi);
        const mid = (lo + hi) >>> 1;
        nthElement(order, centroids, axis, lo, hi, mid);
        this.split(order, centroids, ids, indices, lo, mid, maxTriangles, maxVertices, clusters);
        this.split(order, centroids, ids, indices, mid, hi, maxTriangles, maxVertices, clusters);
    }
    private longestAxis(order: Uint32Array, centroids: Float32Array, lo: number, hi: number): number {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = lo; i < hi; i++) {
            const c = order[i] * 3;
            const x = centroids[c], y = centroids[c + 1], z = centroids[c + 2];
            if (x < minX)
                minX = x;
            if (x > maxX)
                maxX = x;
            if (y < minY)
                minY = y;
            if (y > maxY)
                maxY = y;
            if (z < minZ)
                minZ = z;
            if (z > maxZ)
                maxZ = z;
        }
        const ex = maxX - minX, ey = maxY - minY, ez = maxZ - minZ;
        if (ex >= ey && ex >= ez)
            return 0;
        return ey >= ez ? 1 : 2;
    }
    private countVertices(order: Uint32Array, ids: Uint32Array, indices: Uint32Array, lo: number, hi: number): number {
        const { stamps } = this;
        const stamp = ++this.stamp;
        let unique = 0;
        for (let i = lo; i < hi; i++) {
            const t = ids[order[i]] * 3;
            for (let k = 0; k < 3; k++) {
                const v = indices[t + k];
                if (stamps[v] !== stamp) {
                    stamps[v] = stamp;
                    unique++;
                }
            }
        }
        return unique;
    }
}
function sequence(length: number): Uint32Array {
    const out = new Uint32Array(length);
    for (let i = 0; i < length; i++)
        out[i] = i;
    return out;
}
export function partitionPoints(points: Float32Array, maxPerGroup: number): Uint32Array[] {
    const count = points.length / 3;
    const order = sequence(count);
    const groups: Uint32Array[] = [];
    const split = (lo: number, hi: number): void => {
        if (hi - lo <= maxPerGroup) {
            groups.push(order.slice(lo, hi));
            return;
        }
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = lo; i < hi; i++) {
            const p = order[i] * 3;
            minX = Math.min(minX, points[p]);
            maxX = Math.max(maxX, points[p]);
            minY = Math.min(minY, points[p + 1]);
            maxY = Math.max(maxY, points[p + 1]);
            minZ = Math.min(minZ, points[p + 2]);
            maxZ = Math.max(maxZ, points[p + 2]);
        }
        const ex = maxX - minX, ey = maxY - minY, ez = maxZ - minZ;
        const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
        const mid = (lo + hi) >>> 1;
        nthElement(order, points, axis, lo, hi, mid);
        split(lo, mid);
        split(mid, hi);
    };
    if (count > 0)
        split(0, count);
    return groups;
}
