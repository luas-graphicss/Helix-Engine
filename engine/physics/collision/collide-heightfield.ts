import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import { clamp } from '@/engine/core/math/scalar';
import { cellDiagonalFrom00 } from '@/engine/terrain/core/heightfield';
import type { BoxShape, CapsuleShape, HeightfieldShape, SphereShape } from '@/engine/physics/shapes/collider-shape';
import { capsuleSegment } from './collide-sphere';
import { MAX_MANIFOLD_POINTS, type ContactResult } from './manifold';
const SAME_SURFACE_COSINE = 0.85;
const MAX_PROBE_CELLS = 8;
const MAX_FOOTPRINT_VERTICES = 25;
const BOX_CORNERS = 8;
const MAX_CANDIDATES = BOX_CORNERS + MAX_FOOTPRINT_VERTICES;
const DEGENERATE_DISTANCE = 1e-6;
const CAPSULE_SAMPLES: readonly number[] = [0, 0.5, 1];
const enum CandidateKind {
    ShapePoint,
    TerrainVertex
}
const shapePoints: Vec3[] = [];
const surfaces: Vec3[] = [];
const normals: Vec3[] = [];
const separations = new Float32Array(MAX_CANDIDATES);
const ids = new Int32Array(MAX_CANDIDATES);
const kinds = new Uint8Array(MAX_CANDIDATES);
const order = new Int32Array(MAX_CANDIDATES);
for (let i = 0; i < MAX_CANDIDATES; i++) {
    shapePoints.push(vec3.create());
    surfaces.push(vec3.create());
    normals.push(vec3.create());
}
let candidateCount = 0;
const triA = vec3.create();
const triB = vec3.create();
const triC = vec3.create();
const triNormal = vec3.create();
const edgeAB = vec3.create();
const edgeAC = vec3.create();
const edgeBC = vec3.create();
const toPoint = vec3.create();
const closest = vec3.create();
const localPoint = vec3.create();
const localSurface = vec3.create();
const localNormal = vec3.create();
const probeSurface = vec3.create();
const probeNormal = vec3.create();
const worldPoint = vec3.create();
const sharedNormal = vec3.create();
const support = vec3.create();
const boxLocal = vec3.create();
const delta = vec3.create();
const segmentStart = vec3.create();
const segmentEnd = vec3.create();
const localStart = vec3.create();
const localEnd = vec3.create();
const samplePoint = vec3.create();
const axis = vec3.create();
function localToGrid(shape: HeightfieldShape, value: number): number {
    return (value + shape.source.halfSize) / shape.source.cellSize;
}
function gridVertex(out: Vec3, shape: HeightfieldShape, gx: number, gz: number): Vec3 {
    const { source } = shape;
    return vec3.set(out, gx * source.cellSize - source.halfSize, source.heightfield.get(gx, gz), gz * source.cellSize - source.halfSize);
}
function fillTriangle(shape: HeightfieldShape, cellX: number, cellZ: number, upper: boolean): void {
    if (cellDiagonalFrom00(cellX, cellZ)) {
        gridVertex(triA, shape, cellX, cellZ);
        if (upper) {
            gridVertex(triB, shape, cellX, cellZ + 1);
            gridVertex(triC, shape, cellX + 1, cellZ + 1);
        }
        else {
            gridVertex(triB, shape, cellX + 1, cellZ + 1);
            gridVertex(triC, shape, cellX + 1, cellZ);
        }
    }
    else if (upper) {
        gridVertex(triA, shape, cellX + 1, cellZ + 1);
        gridVertex(triB, shape, cellX, cellZ + 1);
        gridVertex(triC, shape, cellX + 1, cellZ);
    }
    else {
        gridVertex(triA, shape, cellX, cellZ);
        gridVertex(triB, shape, cellX + 1, cellZ);
        gridVertex(triC, shape, cellX, cellZ + 1);
    }
    vec3.subtract(edgeAB, triB, triA);
    vec3.subtract(edgeAC, triC, triA);
    vec3.cross(triNormal, edgeAB, edgeAC);
    if (triNormal[1] < 0)
        vec3.scale(triNormal, triNormal, -1);
    vec3.normalize(triNormal, triNormal);
}
function fillTriangleUnder(shape: HeightfieldShape, x: number, z: number): void {
    const last = shape.source.resolution - 1;
    const gx = clamp(localToGrid(shape, x), 0, last);
    const gz = clamp(localToGrid(shape, z), 0, last);
    const cellX = Math.min(Math.floor(gx), last - 1);
    const cellZ = Math.min(Math.floor(gz), last - 1);
    const fx = gx - cellX;
    const fz = gz - cellZ;
    const upper = cellDiagonalFrom00(cellX, cellZ) ? fz >= fx : fx + fz > 1;
    fillTriangle(shape, cellX, cellZ, upper);
}
function surfaceHeight(shape: HeightfieldShape, x: number, z: number): number {
    return shape.source.heightfield.sampleTriangulated(localToGrid(shape, x), localToGrid(shape, z));
}
function closestPointOnTriangle(out: Vec3, p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
    vec3.subtract(edgeAB, b, a);
    vec3.subtract(edgeAC, c, a);
    vec3.subtract(toPoint, p, a);
    const d1 = vec3.dot(edgeAB, toPoint);
    const d2 = vec3.dot(edgeAC, toPoint);
    if (d1 <= 0 && d2 <= 0)
        return vec3.copy(out, a);
    vec3.subtract(toPoint, p, b);
    const d3 = vec3.dot(edgeAB, toPoint);
    const d4 = vec3.dot(edgeAC, toPoint);
    if (d3 >= 0 && d4 <= d3)
        return vec3.copy(out, b);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0)
        return vec3.scaleAndAdd(out, a, edgeAB, d1 / (d1 - d3));
    vec3.subtract(toPoint, p, c);
    const d5 = vec3.dot(edgeAB, toPoint);
    const d6 = vec3.dot(edgeAC, toPoint);
    if (d6 >= 0 && d5 <= d6)
        return vec3.copy(out, c);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0)
        return vec3.scaleAndAdd(out, a, edgeAC, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        vec3.subtract(edgeBC, c, b);
        return vec3.scaleAndAdd(out, b, edgeBC, (d4 - d3) / (d4 - d3 + (d5 - d6)));
    }
    const denominator = 1 / (va + vb + vc);
    vec3.scaleAndAdd(out, a, edgeAB, vb * denominator);
    return vec3.scaleAndAdd(out, out, edgeAC, vc * denominator);
}
function normalToWorld(out: Vec3, shape: HeightfieldShape, local: Vec3): Vec3 {
    mat4.transformDirection(out, shape.matrix, local);
    return vec3.normalize(out, out);
}
function probeSphere(shape: HeightfieldShape, center: Vec3, radius: number, margin: number): number {
    const { source } = shape;
    const half = source.halfSize;
    const reach = radius + margin;
    if (center[0] < -half - reach || center[0] > half + reach || center[2] < -half - reach || center[2] > half + reach)
        return Infinity;
    const x = clamp(center[0], -half, half);
    const z = clamp(center[2], -half, half);
    const height = surfaceHeight(shape, x, z);
    if (center[1] < height) {
        fillTriangleUnder(shape, x, z);
        vec3.set(probeSurface, x, height, z);
        vec3.copy(probeNormal, triNormal);
        return (center[1] - height) * triNormal[1] - radius;
    }
    const last = source.resolution - 1;
    const cellX0 = clamp(Math.floor(localToGrid(shape, center[0] - reach)), 0, last - 1);
    const cellX1 = clamp(Math.floor(localToGrid(shape, center[0] + reach)), 0, last - 1);
    const cellZ0 = clamp(Math.floor(localToGrid(shape, center[2] - reach)), 0, last - 1);
    const cellZ1 = clamp(Math.floor(localToGrid(shape, center[2] + reach)), 0, last - 1);
    const stride = Math.max(1, Math.ceil(Math.max(cellX1 - cellX0, cellZ1 - cellZ0) / MAX_PROBE_CELLS));
    let best = Infinity;
    for (let cellZ = cellZ0; cellZ <= cellZ1; cellZ += stride) {
        for (let cellX = cellX0; cellX <= cellX1; cellX += stride) {
            for (let side = 0; side < 2; side++) {
                fillTriangle(shape, cellX, cellZ, side === 1);
                closestPointOnTriangle(closest, center, triA, triB, triC);
                vec3.subtract(delta, center, closest);
                const distance = vec3.length(delta);
                const separation = distance - radius;
                if (separation >= best)
                    continue;
                best = separation;
                vec3.copy(probeSurface, closest);
                if (distance > DEGENERATE_DISTANCE)
                    vec3.scale(probeNormal, delta, 1 / distance);
                else
                    vec3.copy(probeNormal, triNormal);
            }
        }
    }
    return best;
}
export function collideSphereHeightfield(center: Vec3, sphere: SphereShape, shape: HeightfieldShape, margin: number, out: ContactResult): void {
    mat4.transformPoint(localPoint, shape.inverse, center);
    const radiusLocal = sphere.radius / shape.scale;
    if (probeSphere(shape, localPoint, radiusLocal, margin / shape.scale) > margin / shape.scale)
        return;
    mat4.transformPoint(worldPoint, shape.matrix, probeSurface);
    normalToWorld(sharedNormal, shape, probeNormal);
    vec3.subtract(delta, center, worldPoint);
    const separation = vec3.dot(delta, sharedNormal) - sphere.radius;
    if (separation > margin)
        return;
    vec3.scale(out.normal, sharedNormal, -1);
    const sphereX = center[0] - sharedNormal[0] * sphere.radius;
    const sphereY = center[1] - sharedNormal[1] * sphere.radius;
    const sphereZ = center[2] - sharedNormal[2] * sphere.radius;
    out.add((worldPoint[0] + sphereX) * 0.5, (worldPoint[1] + sphereY) * 0.5, (worldPoint[2] + sphereZ) * 0.5, separation, 0);
}
export function collideCapsuleHeightfield(position: Vec3, rotation: Mat3, capsule: CapsuleShape, shape: HeightfieldShape, margin: number, out: ContactResult): void {
    capsuleSegment(segmentStart, segmentEnd, position, rotation, capsule);
    mat4.transformPoint(localStart, shape.inverse, segmentStart);
    mat4.transformPoint(localEnd, shape.inverse, segmentEnd);
    const radiusLocal = capsule.radius / shape.scale;
    const marginLocal = margin / shape.scale;
    candidateCount = 0;
    let deepest = -1;
    let deepestSeparation = Infinity;
    const sampleCount = capsule.halfHeight > 0 ? CAPSULE_SAMPLES.length : 1;
    for (let i = 0; i < sampleCount; i++) {
        const t = sampleCount === 1 ? 0.5 : CAPSULE_SAMPLES[i];
        vec3.set(samplePoint, localStart[0] + (localEnd[0] - localStart[0]) * t, localStart[1] + (localEnd[1] - localStart[1]) * t, localStart[2] + (localEnd[2] - localStart[2]) * t);
        const separation = probeSphere(shape, samplePoint, radiusLocal, marginLocal);
        if (separation > marginLocal)
            continue;
        const index = candidateCount++;
        mat4.transformPoint(shapePoints[index], shape.matrix, samplePoint);
        mat4.transformPoint(surfaces[index], shape.matrix, probeSurface);
        normalToWorld(normals[index], shape, probeNormal);
        ids[index] = i;
        if (separation < deepestSeparation) {
            deepestSeparation = separation;
            deepest = index;
        }
    }
    if (deepest < 0)
        return;
    vec3.copy(sharedNormal, normals[deepest]);
    vec3.scale(out.normal, sharedNormal, -1);
    for (let i = 0; i < candidateCount; i++) {
        if (i !== deepest && vec3.dot(normals[i], sharedNormal) < SAME_SURFACE_COSINE)
            continue;
        vec3.subtract(delta, shapePoints[i], surfaces[i]);
        const separation = vec3.dot(delta, sharedNormal) - capsule.radius;
        if (separation > margin)
            continue;
        const surface = surfaces[i];
        const center = shapePoints[i];
        const capsuleX = center[0] - sharedNormal[0] * capsule.radius;
        const capsuleY = center[1] - sharedNormal[1] * capsule.radius;
        const capsuleZ = center[2] - sharedNormal[2] * capsule.radius;
        out.add((surface[0] + capsuleX) * 0.5, (surface[1] + capsuleY) * 0.5, (surface[2] + capsuleZ) * 0.5, separation, ids[i]);
    }
}
function boxSupport(out: Vec3, position: Vec3, rotation: Mat3, halfExtents: Vec3, direction: Vec3): Vec3 {
    vec3.copy(out, position);
    for (let k = 0; k < 3; k++) {
        mat3.getColumn(axis, rotation, k as 0 | 1 | 2);
        const sign = vec3.dot(axis, direction) >= 0 ? 1 : -1;
        vec3.scaleAndAdd(out, out, axis, sign * halfExtents[k]);
    }
    return out;
}
function candidateSeparation(index: number, normal: Vec3, position: Vec3, rotation: Mat3, halfExtents: Vec3): number {
    if (kinds[index] === CandidateKind.TerrainVertex) {
        vec3.scale(delta, normal, -1);
        boxSupport(shapePoints[index], position, rotation, halfExtents, delta);
    }
    vec3.subtract(delta, shapePoints[index], surfaces[index]);
    return vec3.dot(delta, normal);
}
export function collideBoxHeightfield(position: Vec3, rotation: Mat3, box: BoxShape, shape: HeightfieldShape, margin: number, out: ContactResult): void {
    const { source } = shape;
    const half = source.halfSize;
    const halfExtents = box.halfExtents;
    candidateCount = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let corner = 0; corner < BOX_CORNERS; corner++) {
        vec3.copy(worldPoint, position);
        for (let k = 0; k < 3; k++) {
            mat3.getColumn(axis, rotation, k as 0 | 1 | 2);
            vec3.scaleAndAdd(worldPoint, worldPoint, axis, (corner >> k) & 1 ? halfExtents[k] : -halfExtents[k]);
        }
        mat4.transformPoint(localPoint, shape.inverse, worldPoint);
        minX = Math.min(minX, localPoint[0]);
        maxX = Math.max(maxX, localPoint[0]);
        minZ = Math.min(minZ, localPoint[2]);
        maxZ = Math.max(maxZ, localPoint[2]);
        if (localPoint[0] < -half || localPoint[0] > half || localPoint[2] < -half || localPoint[2] > half)
            continue;
        const height = surfaceHeight(shape, localPoint[0], localPoint[2]);
        fillTriangleUnder(shape, localPoint[0], localPoint[2]);
        vec3.set(localSurface, localPoint[0], height, localPoint[2]);
        const index = candidateCount;
        mat4.transformPoint(surfaces[index], shape.matrix, localSurface);
        normalToWorld(normals[index], shape, triNormal);
        vec3.copy(shapePoints[index], worldPoint);
        kinds[index] = CandidateKind.ShapePoint;
        ids[index] = corner;
        vec3.subtract(delta, worldPoint, surfaces[index]);
        separations[index] = vec3.dot(delta, normals[index]);
        if (separations[index] <= margin)
            candidateCount++;
    }
    let deepestCorner = Infinity;
    for (let i = 0; i < candidateCount; i++)
        deepestCorner = Math.min(deepestCorner, separations[i]);
    const vertexGate = deepestCorner - Math.max(margin, 0);
    const last = source.resolution - 1;
    if (maxX >= -half && minX <= half && maxZ >= -half && minZ <= half) {
        const gx0 = clamp(Math.ceil(localToGrid(shape, minX)), 0, last);
        const gx1 = clamp(Math.floor(localToGrid(shape, maxX)), 0, last);
        const gz0 = clamp(Math.ceil(localToGrid(shape, minZ)), 0, last);
        const gz1 = clamp(Math.floor(localToGrid(shape, maxZ)), 0, last);
        const perSide = Math.ceil(Math.sqrt(MAX_FOOTPRINT_VERTICES));
        const stride = Math.max(1, Math.ceil(Math.max(gx1 - gx0 + 1, gz1 - gz0 + 1) / perSide));
        for (let gz = gz0; gz <= gz1 && candidateCount < MAX_CANDIDATES; gz += stride) {
            for (let gx = gx0; gx <= gx1 && candidateCount < MAX_CANDIDATES; gx += stride) {
                gridVertex(localSurface, shape, gx, gz);
                mat4.transformPoint(worldPoint, shape.matrix, localSurface);
                vec3.subtract(delta, worldPoint, position);
                mat3.transformVec3Transposed(boxLocal, rotation, delta);
                if (Math.abs(boxLocal[0]) > halfExtents[0] || Math.abs(boxLocal[1]) > halfExtents[1] || Math.abs(boxLocal[2]) > halfExtents[2])
                    continue;
                const index = candidateCount;
                vec3.copy(surfaces[index], worldPoint);
                source.heightfield.normalAt(localNormal, gx, gz, source.cellSize);
                normalToWorld(normals[index], shape, localNormal);
                kinds[index] = CandidateKind.TerrainVertex;
                ids[index] = BOX_CORNERS + gz * source.resolution + gx;
                separations[index] = candidateSeparation(index, normals[index], position, rotation, halfExtents);
                if (separations[index] <= margin && separations[index] < vertexGate)
                    candidateCount++;
            }
        }
    }
    if (candidateCount === 0)
        return;
    vec3.set(sharedNormal, 0, 0, 0);
    let deepest = 0;
    for (let i = 0; i < candidateCount; i++) {
        if (separations[i] < separations[deepest])
            deepest = i;
        vec3.scaleAndAdd(sharedNormal, sharedNormal, normals[i], Math.max(margin - separations[i], 1e-3));
    }
    if (vec3.length(sharedNormal) < DEGENERATE_DISTANCE)
        vec3.copy(sharedNormal, normals[deepest]);
    vec3.normalize(sharedNormal, sharedNormal);
    let kept = 0;
    for (let i = 0; i < candidateCount; i++) {
        const separation = candidateSeparation(i, sharedNormal, position, rotation, halfExtents);
        if (separation > margin)
            continue;
        separations[i] = separation;
        order[kept++] = i;
    }
    if (kept === 0)
        return;
    for (let i = 1; i < kept; i++) {
        const current = order[i];
        let j = i - 1;
        while (j >= 0 && separations[order[j]] > separations[current]) {
            order[j + 1] = order[j];
            j--;
        }
        order[j + 1] = current;
    }
    vec3.scale(out.normal, sharedNormal, -1);
    const emitted = Math.min(kept, MAX_MANIFOLD_POINTS);
    for (let i = 0; i < emitted; i++) {
        const index = order[i];
        const surface = surfaces[index];
        if (kinds[index] === CandidateKind.TerrainVertex) {
            out.add(surface[0], surface[1], surface[2], separations[index], ids[index]);
        }
        else {
            const point = shapePoints[index];
            out.add((surface[0] + point[0]) * 0.5, (surface[1] + point[1]) * 0.5, (surface[2] + point[2]) * 0.5, separations[index], ids[index]);
        }
    }
}
