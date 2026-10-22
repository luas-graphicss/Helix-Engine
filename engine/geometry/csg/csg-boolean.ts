import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import { createIndexArray, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { BspNode, bspIntersect, bspSubtract, bspUnion } from './csg-bsp';
import { CSG_EPSILON, CsgPolygon, createVertex, type CsgVertex } from './csg-polygon';
export type CsgOperation = 'subtract' | 'union' | 'intersect';
export interface CsgOperationStats {
    clippedTriangles: number;
    brushTriangles: number;
    resultTriangles: number;
}
const SHARED_TARGET = 0;
const SHARED_BRUSH = 1;
const BOUNDS_PADDING = CSG_EPSILON * 16;
const PARITY_DIRECTION = normalizeDirection(0.5773, 0.6173, 0.5345);
const normalScratch = mat3.create();
function normalizeDirection(x: number, y: number, z: number): readonly [
    number,
    number,
    number
] {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
}
function determinant3(m: Mat4): number {
    return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
}
interface BrushData {
    polygons: CsgPolygon[];
    min: Float64Array;
    max: Float64Array;
}
function buildBrush(brush: MeshData, matrix: Mat4): BrushData | null {
    const normalMatrix = mat4.normalMatrix(normalScratch, matrix);
    if (!normalMatrix)
        return null;
    const flip = determinant3(matrix) < 0;
    const { positions, normals, uvs, indices } = brush;
    const vertexCount = positions.length / 3;
    const hasUvs = uvs.length === vertexCount * 2;
    const vertices = new Array<CsgVertex>(vertexCount);
    const min = new Float64Array([Infinity, Infinity, Infinity]);
    const max = new Float64Array([-Infinity, -Infinity, -Infinity]);
    for (let i = 0; i < vertexCount; i++) {
        const p = i * 3;
        const x = positions[p];
        const y = positions[p + 1];
        const z = positions[p + 2];
        const wx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        const wy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        const wz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
        const nx = normals[p];
        const ny = normals[p + 1];
        const nz = normals[p + 2];
        let tx = normalMatrix[0] * nx + normalMatrix[3] * ny + normalMatrix[6] * nz;
        let ty = normalMatrix[1] * nx + normalMatrix[4] * ny + normalMatrix[7] * nz;
        let tz = normalMatrix[2] * nx + normalMatrix[5] * ny + normalMatrix[8] * nz;
        const length = Math.hypot(tx, ty, tz) || 1;
        tx /= length;
        ty /= length;
        tz /= length;
        vertices[i] = createVertex(wx, wy, wz, tx, ty, tz, hasUvs ? uvs[i * 2] : 0, hasUvs ? uvs[i * 2 + 1] : 0);
        if (wx < min[0])
            min[0] = wx;
        if (wy < min[1])
            min[1] = wy;
        if (wz < min[2])
            min[2] = wz;
        if (wx > max[0])
            max[0] = wx;
        if (wy > max[1])
            max[1] = wy;
        if (wz > max[2])
            max[2] = wz;
    }
    const polygons: CsgPolygon[] = [];
    for (let i = 0; i < indices.length; i += 3) {
        const a = vertices[indices[i]];
        const b = vertices[flip ? indices[i + 2] : indices[i + 1]];
        const c = vertices[flip ? indices[i + 1] : indices[i + 2]];
        const polygon = CsgPolygon.fromVertices([a, b, c], SHARED_BRUSH);
        if (polygon)
            polygons.push(polygon);
    }
    for (let axis = 0; axis < 3; axis++) {
        min[axis] -= BOUNDS_PADDING;
        max[axis] += BOUNDS_PADDING;
    }
    return { polygons, min, max };
}
function pointInsideMesh(px: number, py: number, pz: number, mesh: MeshData): boolean {
    const { positions, indices } = mesh;
    const [dx, dy, dz] = PARITY_DIRECTION;
    let crossings = 0;
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;
        const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
        const e1x = positions[b] - ax, e1y = positions[b + 1] - ay, e1z = positions[b + 2] - az;
        const e2x = positions[c] - ax, e2y = positions[c + 1] - ay, e2z = positions[c + 2] - az;
        const hx = dy * e2z - dz * e2y;
        const hy = dz * e2x - dx * e2z;
        const hz = dx * e2y - dy * e2x;
        const det = e1x * hx + e1y * hy + e1z * hz;
        if (det > -1e-12 && det < 1e-12)
            continue;
        const inv = 1 / det;
        const sx = px - ax, sy = py - ay, sz = pz - az;
        const u = (sx * hx + sy * hy + sz * hz) * inv;
        if (u < 0 || u > 1)
            continue;
        const qx = sy * e1z - sz * e1y;
        const qy = sz * e1x - sx * e1z;
        const qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1)
            continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-9)
            crossings++;
    }
    return (crossings & 1) === 1;
}
function weldKey(v: CsgVertex): string {
    return `${Math.round(v.x * 1e5)}|${Math.round(v.y * 1e5)}|${Math.round(v.z * 1e5)}|${Math.round(v.nx * 1e3)}|${Math.round(v.ny * 1e3)}|${Math.round(v.nz * 1e3)}|${Math.round(v.u * 1e4)}|${Math.round(v.v * 1e4)}`;
}
function assemble(name: string, target: MeshData, keptTriangles: Int32Array, keptCount: number, seedVertices: Int32Array, seedCount: number, polygons: readonly CsgPolygon[], targetVertices: Array<CsgVertex | undefined>): MeshData {
    const { positions, normals, uvs, indices } = target;
    const vertexCount = positions.length / 3;
    const hasUvs = uvs.length === vertexCount * 2;
    let polygonVertices = 0;
    for (const polygon of polygons)
        polygonVertices += polygon.vertices.length;
    const capacity = vertexCount + polygonVertices;
    const outPositions = new Float32Array(capacity * 3);
    const outNormals = new Float32Array(capacity * 3);
    const outUvs = new Float32Array(capacity * 2);
    const outIndices: number[] = [];
    const remap = new Int32Array(vertexCount).fill(-1);
    let count = 0;
    const emitOriginal = (index: number): number => {
        let mapped = remap[index];
        if (mapped >= 0)
            return mapped;
        mapped = count++;
        remap[index] = mapped;
        outPositions[mapped * 3] = positions[index * 3];
        outPositions[mapped * 3 + 1] = positions[index * 3 + 1];
        outPositions[mapped * 3 + 2] = positions[index * 3 + 2];
        outNormals[mapped * 3] = normals[index * 3];
        outNormals[mapped * 3 + 1] = normals[index * 3 + 1];
        outNormals[mapped * 3 + 2] = normals[index * 3 + 2];
        if (hasUvs) {
            outUvs[mapped * 2] = uvs[index * 2];
            outUvs[mapped * 2 + 1] = uvs[index * 2 + 1];
        }
        return mapped;
    };
    for (let i = 0; i < keptCount; i++) {
        const tri = keptTriangles[i] * 3;
        outIndices.push(emitOriginal(indices[tri]), emitOriginal(indices[tri + 1]), emitOriginal(indices[tri + 2]));
    }
    const seeds = new Map<string, number>();
    for (let i = 0; i < seedCount; i++) {
        const original = seedVertices[i];
        const vertex = targetVertices[original];
        if (vertex)
            seeds.set(weldKey(vertex), original);
    }
    const welded = new Map<string, number>();
    const emitVertex = (vertex: CsgVertex): number => {
        const key = weldKey(vertex);
        const existing = welded.get(key);
        if (existing !== undefined)
            return existing;
        const seed = seeds.get(key);
        const mapped = seed !== undefined ? emitOriginal(seed) : count++;
        if (seed === undefined) {
            outPositions[mapped * 3] = vertex.x;
            outPositions[mapped * 3 + 1] = vertex.y;
            outPositions[mapped * 3 + 2] = vertex.z;
            outNormals[mapped * 3] = vertex.nx;
            outNormals[mapped * 3 + 1] = vertex.ny;
            outNormals[mapped * 3 + 2] = vertex.nz;
            outUvs[mapped * 2] = vertex.u;
            outUvs[mapped * 2 + 1] = vertex.v;
        }
        welded.set(key, mapped);
        return mapped;
    };
    for (const polygon of polygons) {
        const { vertices } = polygon;
        const first = emitVertex(vertices[0]);
        let previous = emitVertex(vertices[1]);
        for (let i = 2; i < vertices.length; i++) {
            const current = emitVertex(vertices[i]);
            if (first !== previous && previous !== current && current !== first)
                outIndices.push(first, previous, current);
            previous = current;
        }
    }
    return {
        name,
        positions: outPositions.slice(0, count * 3),
        normals: outNormals.slice(0, count * 3),
        uvs: outUvs.slice(0, count * 2),
        indices: createIndexArray(outIndices, count),
    };
}
export function createEmptyMesh(name: string): MeshData {
    return { name, positions: new Float32Array(0), normals: new Float32Array(0), uvs: new Float32Array(0), indices: new Uint16Array(0) };
}
export function copyMeshData(mesh: MeshData, name = mesh.name): MeshData {
    return { name, positions: mesh.positions.slice(), normals: mesh.normals.slice(), uvs: mesh.uvs.slice(), indices: mesh.indices.slice() };
}
export function csgOperate(operation: CsgOperation, target: MeshData, brush: MeshData, brushToTarget: Mat4, stats?: CsgOperationStats, exact = false): MeshData {
    const brushData = buildBrush(brush, brushToTarget);
    if (stats) {
        stats.clippedTriangles = 0;
        stats.brushTriangles = brushData?.polygons.length ?? 0;
        stats.resultTriangles = target.indices.length / 3;
    }
    if (!brushData || brushData.polygons.length === 0)
        return target;
    const { positions, indices } = target;
    const vertexCount = positions.length / 3;
    const triangleCount = indices.length / 3;
    const { min, max } = brushData;
    const kept = new Int32Array(triangleCount);
    const clipped = new Int32Array(triangleCount);
    let keptCount = 0;
    let clippedCount = 0;
    for (let t = 0; t < triangleCount; t++) {
        const a = indices[t * 3] * 3;
        const b = indices[t * 3 + 1] * 3;
        const c = indices[t * 3 + 2] * 3;
        let overlaps = true;
        for (let axis = 0; axis < 3 && overlaps && !exact; axis++) {
            const pa = positions[a + axis];
            const pb = positions[b + axis];
            const pc = positions[c + axis];
            const lo = pa < pb ? (pa < pc ? pa : pc) : pb < pc ? pb : pc;
            const hi = pa > pb ? (pa > pc ? pa : pc) : pb > pc ? pb : pc;
            if (hi < min[axis] || lo > max[axis])
                overlaps = false;
        }
        if (overlaps)
            clipped[clippedCount++] = t;
        else
            kept[keptCount++] = t;
    }
    if (stats)
        stats.clippedTriangles = clippedCount;
    const targetVertices = new Array<CsgVertex | undefined>(vertexCount);
    const seedVertices = new Int32Array(clippedCount * 3);
    let seedCount = 0;
    if (clippedCount === 0) {
        const probe = brushData.polygons[0].vertices[0];
        const inside = triangleCount > 0 && pointInsideMesh(probe.x, probe.y, probe.z, target);
        let result: MeshData;
        switch (operation) {
            case 'subtract':
                result = inside ? assemble(target.name, target, kept, keptCount, seedVertices, 0, brushData.polygons.map((p) => p.flip()), targetVertices) : target;
                break;
            case 'union':
                result = inside ? target : assemble(target.name, target, kept, keptCount, seedVertices, 0, brushData.polygons, targetVertices);
                break;
            case 'intersect':
                result = inside ? assemble(target.name, target, kept, 0, seedVertices, 0, brushData.polygons, targetVertices) : createEmptyMesh(target.name);
                break;
        }
        if (stats)
            stats.resultTriangles = result.indices.length / 3;
        return result;
    }
    const { normals, uvs } = target;
    const hasUvs = uvs.length === vertexCount * 2;
    const vertexAt = (index: number): CsgVertex => {
        let vertex = targetVertices[index];
        if (!vertex) {
            const p = index * 3;
            vertex = createVertex(positions[p], positions[p + 1], positions[p + 2], normals[p], normals[p + 1], normals[p + 2], hasUvs ? uvs[index * 2] : 0, hasUvs ? uvs[index * 2 + 1] : 0);
            targetVertices[index] = vertex;
            seedVertices[seedCount++] = index;
        }
        return vertex;
    };
    const targetPolygons: CsgPolygon[] = [];
    for (let i = 0; i < clippedCount; i++) {
        const tri = clipped[i] * 3;
        const polygon = CsgPolygon.fromVertices([vertexAt(indices[tri]), vertexAt(indices[tri + 1]), vertexAt(indices[tri + 2])], SHARED_TARGET);
        if (polygon)
            targetPolygons.push(polygon);
    }
    const a = BspNode.build(targetPolygons);
    const b = BspNode.build(brushData.polygons);
    let polygons: CsgPolygon[];
    switch (operation) {
        case 'subtract':
            polygons = bspSubtract(a, b);
            break;
        case 'union':
            polygons = bspUnion(a, b);
            break;
        case 'intersect':
            polygons = bspIntersect(a, b);
            break;
    }
    const result = operation === 'intersect'
        ? assemble(target.name, target, kept, 0, seedVertices, seedCount, polygons, targetVertices)
        : assemble(target.name, target, kept, keptCount, seedVertices, seedCount, polygons, targetVertices);
    if (stats)
        stats.resultTriangles = result.indices.length / 3;
    return result;
}
