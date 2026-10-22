import { createIndexArray, type MeshData } from '@/engine/renderer/geometry/mesh-data';
export const DEFAULT_SMOOTHING_ANGLE_DEGREES = 45;
type PositionGetter = (corner: number) => readonly [
    number,
    number,
    number
];
function newellNormal(count: number, position: PositionGetter): [
    number,
    number,
    number
] {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i < count; i++) {
        const [ax, ay, az] = position(i);
        const [bx, by, bz] = position((i + 1) % count);
        nx += (ay - by) * (az + bz);
        ny += (az - bz) * (ax + bx);
        nz += (ax - bx) * (ay + by);
    }
    return [nx, ny, nz];
}
export function triangulatePolygon(count: number, position: PositionGetter, out: number[]): void {
    if (count < 3)
        return;
    if (count === 3) {
        out.push(0, 1, 2);
        return;
    }
    if (count === 4) {
        const p0 = position(0), p1 = position(1), p2 = position(2), p3 = position(3);
        const d02 = (p0[0] - p2[0]) ** 2 + (p0[1] - p2[1]) ** 2 + (p0[2] - p2[2]) ** 2;
        const d13 = (p1[0] - p3[0]) ** 2 + (p1[1] - p3[1]) ** 2 + (p1[2] - p3[2]) ** 2;
        if (d02 <= d13)
            out.push(0, 1, 2, 0, 2, 3);
        else
            out.push(0, 1, 3, 1, 2, 3);
        return;
    }
    const [nx, ny, nz] = newellNormal(count, position);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const project = (i: number): [
        number,
        number
    ] => {
        const p = position(i);
        if (ax >= ay && ax >= az)
            return nx >= 0 ? [p[1], p[2]] : [p[2], p[1]];
        if (ay >= az)
            return ny >= 0 ? [p[2], p[0]] : [p[0], p[2]];
        return nz >= 0 ? [p[0], p[1]] : [p[1], p[0]];
    };
    const points: Array<[
        number,
        number
    ]> = [];
    for (let i = 0; i < count; i++)
        points.push(project(i));
    const cross = (a: [
        number,
        number
    ], b: [
        number,
        number
    ], c: [
        number,
        number
    ]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p: [
        number,
        number
    ], a: [
        number,
        number
    ], b: [
        number,
        number
    ], c: [
        number,
        number
    ]) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
    const remaining: number[] = [];
    for (let i = 0; i < count; i++)
        remaining.push(i);
    let guard = count * count;
    while (remaining.length > 3 && guard-- > 0) {
        let clipped = false;
        for (let i = 0; i < remaining.length; i++) {
            const prev = remaining[(i + remaining.length - 1) % remaining.length];
            const curr = remaining[i];
            const next = remaining[(i + 1) % remaining.length];
            const a = points[prev], b = points[curr], c = points[next];
            if (cross(a, b, c) <= 0)
                continue;
            let isEar = true;
            for (const other of remaining) {
                if (other === prev || other === curr || other === next)
                    continue;
                if (inside(points[other], a, b, c)) {
                    isEar = false;
                    break;
                }
            }
            if (!isEar)
                continue;
            out.push(prev, curr, next);
            remaining.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped)
            break;
    }
    for (let i = 1; i + 1 < remaining.length; i++)
        out.push(remaining[0], remaining[i], remaining[i + 1]);
}
function quantizationStep(positions: ArrayLike<number>): number {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < positions.length; i++) {
        const value = positions[i];
        if (value < min)
            min = value;
        if (value > max)
            max = value;
    }
    const extent = Number.isFinite(max - min) ? max - min : 1;
    return Math.max(extent * 1e-6, 1e-12);
}
function positionKey(positions: ArrayLike<number>, vertex: number, step: number): string {
    const i = vertex * 3;
    return `${Math.round(positions[i] / step)},${Math.round(positions[i + 1] / step)},${Math.round(positions[i + 2] / step)}`;
}
export function weldPositions(soup: ArrayLike<number>): {
    positions: Float32Array;
    indices: Uint32Array;
} {
    const step = quantizationStep(soup);
    const lookup = new Map<string, number>();
    const positions: number[] = [];
    const vertexCount = soup.length / 3;
    const indices = new Uint32Array(vertexCount);
    for (let v = 0; v < vertexCount; v++) {
        const key = positionKey(soup, v, step);
        let index = lookup.get(key);
        if (index === undefined) {
            index = positions.length / 3;
            lookup.set(key, index);
            positions.push(soup[v * 3], soup[v * 3 + 1], soup[v * 3 + 2]);
        }
        indices[v] = index;
    }
    return { positions: new Float32Array(positions), indices };
}
export function signedVolume(positions: ArrayLike<number>, indices: ArrayLike<number>): number {
    let volume = 0;
    for (let i = 0; i + 2 < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
        const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
        const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
        const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
        volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    }
    return volume / 6;
}
export function ensureOutwardWinding(positions: ArrayLike<number>, indices: Uint16Array | Uint32Array): boolean {
    if (signedVolume(positions, indices) >= 0)
        return false;
    for (let i = 0; i + 2 < indices.length; i += 3) {
        const swap = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = swap;
    }
    return true;
}
export function withFlatNormals(name: string, positions: ArrayLike<number>, uvs: ArrayLike<number> | null, indices: ArrayLike<number>): MeshData {
    const triangleCount = Math.floor(indices.length / 3);
    const outPositions = new Float32Array(triangleCount * 9);
    const outNormals = new Float32Array(triangleCount * 9);
    const outUvs = new Float32Array(triangleCount * 6);
    const outIndices = new Uint32Array(triangleCount * 3);
    for (let t = 0; t < triangleCount; t++) {
        const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];
        const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
        const bx = positions[i1 * 3], by = positions[i1 * 3 + 1], bz = positions[i1 * 3 + 2];
        const cx = positions[i2 * 3], cy = positions[i2 * 3 + 1], cz = positions[i2 * 3 + 2];
        let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        const corners = [i0, i1, i2];
        for (let c = 0; c < 3; c++) {
            const src = corners[c];
            const dst = t * 3 + c;
            outPositions[dst * 3] = positions[src * 3];
            outPositions[dst * 3 + 1] = positions[src * 3 + 1];
            outPositions[dst * 3 + 2] = positions[src * 3 + 2];
            outNormals[dst * 3] = nx;
            outNormals[dst * 3 + 1] = ny;
            outNormals[dst * 3 + 2] = nz;
            if (uvs) {
                outUvs[dst * 2] = uvs[src * 2];
                outUvs[dst * 2 + 1] = uvs[src * 2 + 1];
            }
            outIndices[dst] = dst;
        }
    }
    return { name, positions: outPositions, normals: outNormals, uvs: outUvs, indices: createIndexArray(outIndices, triangleCount * 3) };
}
interface NormalCluster {
    rx: number;
    ry: number;
    rz: number;
    sx: number;
    sy: number;
    sz: number;
    outputByInput: Map<number, number>;
}
export function withSmoothNormals(name: string, positions: ArrayLike<number>, uvs: ArrayLike<number> | null, indices: ArrayLike<number>, angleDegrees = DEFAULT_SMOOTHING_ANGLE_DEGREES): MeshData {
    if (angleDegrees <= 0)
        return withFlatNormals(name, positions, uvs, indices);
    const cosThreshold = Math.cos(Math.min(angleDegrees, 180) * (Math.PI / 180));
    const step = quantizationStep(positions);
    const clustersByPosition = new Map<string, NormalCluster[]>();
    const keyCache = new Map<number, string>();
    const triangleCount = Math.floor(indices.length / 3);
    const cornerClusters: NormalCluster[] = new Array(triangleCount * 3);
    for (let t = 0; t < triangleCount; t++) {
        const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];
        const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
        const bx = positions[i1 * 3], by = positions[i1 * 3 + 1], bz = positions[i1 * 3 + 2];
        const cx = positions[i2 * 3], cy = positions[i2 * 3 + 1], cz = positions[i2 * 3 + 2];
        const wx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        const wy = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        const wz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const length = Math.hypot(wx, wy, wz) || 1;
        const fx = wx / length, fy = wy / length, fz = wz / length;
        for (let c = 0; c < 3; c++) {
            const vertex = indices[t * 3 + c];
            let key = keyCache.get(vertex);
            if (key === undefined) {
                key = positionKey(positions, vertex, step);
                keyCache.set(vertex, key);
            }
            let clusters = clustersByPosition.get(key);
            if (!clusters) {
                clusters = [];
                clustersByPosition.set(key, clusters);
            }
            let cluster = clusters.find((candidate) => candidate.rx * fx + candidate.ry * fy + candidate.rz * fz >= cosThreshold);
            if (!cluster) {
                cluster = { rx: fx, ry: fy, rz: fz, sx: 0, sy: 0, sz: 0, outputByInput: new Map() };
                clusters.push(cluster);
            }
            cluster.sx += wx;
            cluster.sy += wy;
            cluster.sz += wz;
            cornerClusters[t * 3 + c] = cluster;
        }
    }
    const outPositions: number[] = [];
    const outUvs: number[] = [];
    const outNormals: number[] = [];
    const outIndices = new Uint32Array(triangleCount * 3);
    for (let corner = 0; corner < triangleCount * 3; corner++) {
        const vertex = indices[corner];
        const cluster = cornerClusters[corner];
        let output = cluster.outputByInput.get(vertex);
        if (output === undefined) {
            output = outPositions.length / 3;
            cluster.outputByInput.set(vertex, output);
            outPositions.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
            outUvs.push(uvs ? uvs[vertex * 2] : 0, uvs ? uvs[vertex * 2 + 1] : 0);
            const length = Math.hypot(cluster.sx, cluster.sy, cluster.sz) || 1;
            outNormals.push(cluster.sx / length, cluster.sy / length, cluster.sz / length);
        }
        outIndices[corner] = output;
    }
    return {
        name,
        positions: new Float32Array(outPositions),
        normals: new Float32Array(outNormals),
        uvs: new Float32Array(outUvs),
        indices: createIndexArray(outIndices, outPositions.length / 3),
    };
}
export function recomputeNormals(mesh: MeshData, mode: 'smooth' | 'flat', angleDegrees = DEFAULT_SMOOTHING_ANGLE_DEGREES): MeshData {
    if (mesh.skinning)
        return mesh;
    return mode === 'flat' ? withFlatNormals(mesh.name, mesh.positions, mesh.uvs, mesh.indices) : withSmoothNormals(mesh.name, mesh.positions, mesh.uvs, mesh.indices, angleDegrees);
}
export function flipUvV(mesh: MeshData): MeshData {
    const uvs = new Float32Array(mesh.uvs);
    for (let i = 1; i < uvs.length; i += 2)
        uvs[i] = 1 - uvs[i];
    return { ...mesh, uvs };
}
export function flipWinding(mesh: MeshData): MeshData {
    const indices = mesh.indices.slice();
    for (let i = 0; i + 2 < indices.length; i += 3) {
        const second = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = second;
    }
    const normals = new Float32Array(mesh.normals);
    for (let i = 0; i < normals.length; i++)
        normals[i] = -normals[i];
    return { ...mesh, indices, normals };
}
export function stripOrFanToTriangles(indices: ArrayLike<number>, mode: 'strip' | 'fan'): Uint32Array {
    const count = Math.max(indices.length - 2, 0);
    const out = new Uint32Array(count * 3);
    for (let i = 0; i < count; i++) {
        if (mode === 'fan') {
            out[i * 3] = indices[0];
            out[i * 3 + 1] = indices[i + 1];
            out[i * 3 + 2] = indices[i + 2];
        }
        else if (i % 2 === 0) {
            out[i * 3] = indices[i];
            out[i * 3 + 1] = indices[i + 1];
            out[i * 3 + 2] = indices[i + 2];
        }
        else {
            out[i * 3] = indices[i + 1];
            out[i * 3 + 1] = indices[i];
            out[i * 3 + 2] = indices[i + 2];
        }
    }
    return out;
}
