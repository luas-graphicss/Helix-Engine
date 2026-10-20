import { createIndexArray, type MeshData } from '@/engine/renderer/geometry/mesh-data';
const QUADRIC_FLOATS = 10;
const SINGULAR_DETERMINANT = 1e-12;
export interface SimplifierInput {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array | Uint32Array;
}
export interface SimplifierOutput {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array | Uint32Array;
}
interface Bounds {
    min: [
        number,
        number,
        number
    ];
    max: [
        number,
        number,
        number
    ];
}
function computeBounds(positions: Float32Array): Bounds {
    const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (let i = 0; i < positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
            const value = positions[i + axis];
            if (value < bounds.min[axis])
                bounds.min[axis] = value;
            if (value > bounds.max[axis])
                bounds.max[axis] = value;
        }
    }
    return bounds;
}
export function simplifyByClustering(input: SimplifierInput, cellsAlongLongestAxis: number): SimplifierOutput {
    const { positions, normals, uvs, indices } = input;
    const vertexCount = positions.length / 3;
    const bounds = computeBounds(positions);
    const extentX = bounds.max[0] - bounds.min[0];
    const extentY = bounds.max[1] - bounds.min[1];
    const extentZ = bounds.max[2] - bounds.min[2];
    const cellSize = Math.max(extentX, extentY, extentZ, 1e-6) / Math.max(cellsAlongLongestAxis, 1);
    const cellsX = Math.floor(extentX / cellSize) + 1;
    const cellsY = Math.floor(extentY / cellSize) + 1;
    const clusterOfVertex = new Int32Array(vertexCount);
    const clusterByCell = new Map<number, number>();
    let clusterCount = 0;
    for (let v = 0; v < vertexCount; v++) {
        const cx = Math.floor((positions[v * 3] - bounds.min[0]) / cellSize);
        const cy = Math.floor((positions[v * 3 + 1] - bounds.min[1]) / cellSize);
        const cz = Math.floor((positions[v * 3 + 2] - bounds.min[2]) / cellSize);
        const key = (cz * cellsY + cy) * cellsX + cx;
        let cluster = clusterByCell.get(key);
        if (cluster === undefined) {
            cluster = clusterCount++;
            clusterByCell.set(key, cluster);
        }
        clusterOfVertex[v] = cluster;
    }
    const sums = new Float64Array(clusterCount * 8);
    const counts = new Uint32Array(clusterCount);
    for (let v = 0; v < vertexCount; v++) {
        const cluster = clusterOfVertex[v];
        const offset = cluster * 8;
        sums[offset] += positions[v * 3];
        sums[offset + 1] += positions[v * 3 + 1];
        sums[offset + 2] += positions[v * 3 + 2];
        sums[offset + 3] += normals[v * 3];
        sums[offset + 4] += normals[v * 3 + 1];
        sums[offset + 5] += normals[v * 3 + 2];
        sums[offset + 6] += uvs[v * 2];
        sums[offset + 7] += uvs[v * 2 + 1];
        counts[cluster]++;
    }
    const quadrics = new Float64Array(clusterCount * QUADRIC_FLOATS);
    const triangleCount = indices.length / 3;
    const survivors: number[] = [];
    for (let t = 0; t < triangleCount; t++) {
        const ia = indices[t * 3], ib = indices[t * 3 + 1], ic = indices[t * 3 + 2];
        const ca = clusterOfVertex[ia], cb = clusterOfVertex[ib], cc = clusterOfVertex[ic];
        accumulatePlane(quadrics, positions, ia, ib, ic, ca, cb, cc);
        if (ca !== cb && cb !== cc && ca !== cc)
            survivors.push(ca, cb, cc);
    }
    const outputIndexOfCluster = new Int32Array(clusterCount).fill(-1);
    let outputVertexCount = 0;
    for (let i = 0; i < survivors.length; i++) {
        const cluster = survivors[i];
        if (outputIndexOfCluster[cluster] === -1)
            outputIndexOfCluster[cluster] = outputVertexCount++;
    }
    const outPositions = new Float32Array(outputVertexCount * 3);
    const outNormals = new Float32Array(outputVertexCount * 3);
    const outUvs = new Float32Array(outputVertexCount * 2);
    for (let cluster = 0; cluster < clusterCount; cluster++) {
        const out = outputIndexOfCluster[cluster];
        if (out === -1)
            continue;
        const offset = cluster * 8;
        const inv = 1 / counts[cluster];
        const meanX = sums[offset] * inv, meanY = sums[offset + 1] * inv, meanZ = sums[offset + 2] * inv;
        solveOptimalPosition(outPositions, out * 3, quadrics, cluster, meanX, meanY, meanZ, cellSize);
        const nx = sums[offset + 3], ny = sums[offset + 4], nz = sums[offset + 5];
        const length = Math.hypot(nx, ny, nz);
        if (length > 1e-8) {
            outNormals[out * 3] = nx / length;
            outNormals[out * 3 + 1] = ny / length;
            outNormals[out * 3 + 2] = nz / length;
        }
        else {
            outNormals[out * 3 + 1] = 1;
        }
        outUvs[out * 2] = sums[offset + 6] * inv;
        outUvs[out * 2 + 1] = sums[offset + 7] * inv;
    }
    const outIndices = new Array<number>(survivors.length);
    for (let i = 0; i < survivors.length; i++)
        outIndices[i] = outputIndexOfCluster[survivors[i]];
    return { positions: outPositions, normals: outNormals, uvs: outUvs, indices: createIndexArray(outIndices, outputVertexCount) };
}
function accumulatePlane(quadrics: Float64Array, positions: Float32Array, ia: number, ib: number, ic: number, ca: number, cb: number, cc: number): void {
    const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
    const ux = positions[ib * 3] - ax, uy = positions[ib * 3 + 1] - ay, uz = positions[ib * 3 + 2] - az;
    const vx = positions[ic * 3] - ax, vy = positions[ic * 3 + 1] - ay, vz = positions[ic * 3 + 2] - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const doubleArea = Math.hypot(nx, ny, nz);
    if (doubleArea < 1e-12)
        return;
    const weight = doubleArea * 0.5;
    nx /= doubleArea;
    ny /= doubleArea;
    nz /= doubleArea;
    const d = -(nx * ax + ny * ay + nz * az);
    addQuadric(quadrics, ca, nx, ny, nz, d, weight);
    if (cb !== ca)
        addQuadric(quadrics, cb, nx, ny, nz, d, weight);
    if (cc !== ca && cc !== cb)
        addQuadric(quadrics, cc, nx, ny, nz, d, weight);
}
function addQuadric(quadrics: Float64Array, cluster: number, a: number, b: number, c: number, d: number, w: number): void {
    const o = cluster * QUADRIC_FLOATS;
    quadrics[o] += a * a * w;
    quadrics[o + 1] += a * b * w;
    quadrics[o + 2] += a * c * w;
    quadrics[o + 3] += a * d * w;
    quadrics[o + 4] += b * b * w;
    quadrics[o + 5] += b * c * w;
    quadrics[o + 6] += b * d * w;
    quadrics[o + 7] += c * c * w;
    quadrics[o + 8] += c * d * w;
    quadrics[o + 9] += d * d * w;
}
function solveOptimalPosition(out: Float32Array, offset: number, quadrics: Float64Array, cluster: number, meanX: number, meanY: number, meanZ: number, cellSize: number): void {
    const o = cluster * QUADRIC_FLOATS;
    const a = quadrics[o], b = quadrics[o + 1], c = quadrics[o + 2];
    const e = quadrics[o + 4], f = quadrics[o + 5];
    const h = quadrics[o + 7];
    const rx = -quadrics[o + 3], ry = -quadrics[o + 6], rz = -quadrics[o + 8];
    const det = a * (e * h - f * f) - b * (b * h - f * c) + c * (b * f - e * c);
    const scale = Math.max(a, e, h, 1e-30);
    if (Math.abs(det) > SINGULAR_DETERMINANT * scale * scale * scale) {
        const x = (rx * (e * h - f * f) - b * (ry * h - f * rz) + c * (ry * f - e * rz)) / det;
        const y = (a * (ry * h - f * rz) - rx * (b * h - f * c) + c * (b * rz - ry * c)) / det;
        const z = (a * (e * rz - ry * f) - b * (b * rz - ry * c) + rx * (b * f - e * c)) / det;
        if (Math.abs(x - meanX) <= cellSize && Math.abs(y - meanY) <= cellSize && Math.abs(z - meanZ) <= cellSize) {
            out[offset] = x;
            out[offset + 1] = y;
            out[offset + 2] = z;
            return;
        }
    }
    out[offset] = meanX;
    out[offset + 1] = meanY;
    out[offset + 2] = meanZ;
}
export function toMeshData(name: string, output: SimplifierOutput): MeshData {
    return { name, positions: output.positions, normals: output.normals, uvs: output.uvs, indices: output.indices };
}
