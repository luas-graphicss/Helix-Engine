import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import { clamp } from '@/engine/core/math/scalar';
import type { BoxShape } from '@/engine/physics/shapes/collider-shape';
import { MAX_MANIFOLD_POINTS, type ContactResult } from './manifold';
const AXIS_FUDGE = 1e-5;
const PARALLEL_EDGE_EPSILON = 1e-6;
const MAX_CLIP_VERTICES = 8;
const EDGE_ID_BASE = 0x1000;
const t = vec3.create();
const axesA = [vec3.create(), vec3.create(), vec3.create()];
const axesB = [vec3.create(), vec3.create(), vec3.create()];
const cosines = new Float32Array(9);
const absCosines = new Float32Array(9);
const tA = new Float32Array(3);
const tB = new Float32Array(3);
const edgeAxis = vec3.create();
const bestEdgeAxis = vec3.create();
const supportA = vec3.create();
const supportB = vec3.create();
const edgeDelta = vec3.create();
const closestA = vec3.create();
const closestB = vec3.create();
const refNormal = vec3.create();
const refCenter = vec3.create();
const incNormal = vec3.create();
const incCenter = vec3.create();
const polygonA = new Float32Array(MAX_CLIP_VERTICES * 3);
const polygonB = new Float32Array(MAX_CLIP_VERTICES * 3);
const idsA = new Int32Array(MAX_CLIP_VERTICES);
const idsB = new Int32Array(MAX_CLIP_VERTICES);
const cornersA = new Int32Array(MAX_CLIP_VERTICES);
const cornersB = new Int32Array(MAX_CLIP_VERTICES);
const candidatePositions = new Float32Array(MAX_CLIP_VERTICES * 3);
const candidateSeparations = new Float32Array(MAX_CLIP_VERTICES);
const candidateIds = new Int32Array(MAX_CLIP_VERTICES);
const candidateAreas = new Float32Array(MAX_CLIP_VERTICES);
const chosen = new Int32Array(MAX_MANIFOLD_POINTS);
interface FaceContext {
    refPosition: Vec3;
    refAxes: Vec3[];
    refHalf: Vec3;
    incPosition: Vec3;
    incAxes: Vec3[];
    incHalf: Vec3;
}
const face: FaceContext = {
    refPosition: vec3.create(),
    refAxes: axesA,
    refHalf: vec3.create(),
    incPosition: vec3.create(),
    incAxes: axesB,
    incHalf: vec3.create(),
};
export function collideBoxBox(positionA: Vec3, rotationA: Mat3, boxA: BoxShape, positionB: Vec3, rotationB: Mat3, boxB: BoxShape, margin: number, linearSlop: number, out: ContactResult): void {
    const hA = boxA.halfExtents;
    const hB = boxB.halfExtents;
    for (let i = 0; i < 3; i++) {
        mat3.getColumn(axesA[i], rotationA, i as 0 | 1 | 2);
        mat3.getColumn(axesB[i], rotationB, i as 0 | 1 | 2);
    }
    vec3.subtract(t, positionB, positionA);
    for (let i = 0; i < 3; i++) {
        tA[i] = vec3.dot(t, axesA[i]);
        tB[i] = vec3.dot(t, axesB[i]);
        for (let j = 0; j < 3; j++) {
            const c = vec3.dot(axesA[i], axesB[j]);
            cosines[i * 3 + j] = c;
            absCosines[i * 3 + j] = Math.abs(c) + AXIS_FUDGE;
        }
    }
    let faceSeparation = -Infinity;
    let faceAxis = 0;
    let faceSign = 1;
    let refIsB = false;
    for (let i = 0; i < 3; i++) {
        const radiusB = hB[0] * absCosines[i * 3] + hB[1] * absCosines[i * 3 + 1] + hB[2] * absCosines[i * 3 + 2];
        const separation = Math.abs(tA[i]) - hA[i] - radiusB;
        if (separation > margin)
            return;
        if (separation > faceSeparation) {
            faceSeparation = separation;
            faceAxis = i;
            faceSign = tA[i] >= 0 ? 1 : -1;
            refIsB = false;
        }
    }
    const faceTolerance = 0.1 * linearSlop;
    for (let j = 0; j < 3; j++) {
        const radiusA = hA[0] * absCosines[j] + hA[1] * absCosines[3 + j] + hA[2] * absCosines[6 + j];
        const separation = Math.abs(tB[j]) - hB[j] - radiusA;
        if (separation > margin)
            return;
        if (separation > faceSeparation + faceTolerance) {
            faceSeparation = separation;
            faceAxis = j;
            faceSign = tB[j] >= 0 ? 1 : -1;
            refIsB = true;
        }
    }
    let edgeSeparation = -Infinity;
    let edgeI = -1;
    let edgeJ = -1;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            vec3.cross(edgeAxis, axesA[i], axesB[j]);
            const lengthSquared = vec3.dot(edgeAxis, edgeAxis);
            if (lengthSquared < PARALLEL_EDGE_EPSILON)
                continue;
            vec3.scale(edgeAxis, edgeAxis, 1 / Math.sqrt(lengthSquared));
            let radiusA = 0;
            let radiusB = 0;
            for (let k = 0; k < 3; k++) {
                if (k !== i)
                    radiusA += hA[k] * Math.abs(vec3.dot(axesA[k], edgeAxis));
                if (k !== j)
                    radiusB += hB[k] * Math.abs(vec3.dot(axesB[k], edgeAxis));
            }
            const projection = vec3.dot(t, edgeAxis);
            const separation = Math.abs(projection) - radiusA - radiusB;
            if (separation > margin)
                return;
            if (separation > edgeSeparation) {
                edgeSeparation = separation;
                edgeI = i;
                edgeJ = j;
                vec3.scale(bestEdgeAxis, edgeAxis, projection >= 0 ? 1 : -1);
            }
        }
    }
    const edgeBias = 0.5 * linearSlop + 0.02 * Math.abs(faceSeparation);
    if (edgeI >= 0 && edgeSeparation > faceSeparation + edgeBias) {
        buildEdgeContact(positionA, hA, positionB, hB, edgeI, edgeJ, edgeSeparation, out);
        return;
    }
    if (refIsB) {
        vec3.copy(face.refPosition, positionB);
        face.refAxes = axesB;
        vec3.copy(face.refHalf, hB);
        vec3.copy(face.incPosition, positionA);
        face.incAxes = axesA;
        vec3.copy(face.incHalf, hA);
        vec3.scale(refNormal, axesB[faceAxis], -faceSign);
    }
    else {
        vec3.copy(face.refPosition, positionA);
        face.refAxes = axesA;
        vec3.copy(face.refHalf, hA);
        vec3.copy(face.incPosition, positionB);
        face.incAxes = axesB;
        vec3.copy(face.incHalf, hB);
        vec3.scale(refNormal, axesA[faceAxis], faceSign);
    }
    buildFaceContact(faceAxis, refIsB, margin, out);
}
function buildEdgeContact(positionA: Vec3, hA: Vec3, positionB: Vec3, hB: Vec3, i: number, j: number, separation: number, out: ContactResult): void {
    const normal = bestEdgeAxis;
    vec3.copy(supportA, positionA);
    vec3.copy(supportB, positionB);
    for (let k = 0; k < 3; k++) {
        if (k !== i)
            vec3.scaleAndAdd(supportA, supportA, axesA[k], (vec3.dot(normal, axesA[k]) >= 0 ? 1 : -1) * hA[k]);
        if (k !== j)
            vec3.scaleAndAdd(supportB, supportB, axesB[k], (vec3.dot(normal, axesB[k]) >= 0 ? -1 : 1) * hB[k]);
    }
    const directionA = axesA[i];
    const directionB = axesB[j];
    vec3.subtract(edgeDelta, supportA, supportB);
    const b = vec3.dot(directionA, directionB);
    const c = vec3.dot(directionA, edgeDelta);
    const f = vec3.dot(directionB, edgeDelta);
    const denominator = 1 - b * b;
    const s = clamp((b * f - c) / denominator, -hA[i], hA[i]);
    const u = clamp(b * s + f, -hB[j], hB[j]);
    vec3.scaleAndAdd(closestA, supportA, directionA, s);
    vec3.scaleAndAdd(closestB, supportB, directionB, u);
    vec3.copy(out.normal, normal);
    out.add((closestA[0] + closestB[0]) * 0.5, (closestA[1] + closestB[1]) * 0.5, (closestA[2] + closestB[2]) * 0.5, separation, EDGE_ID_BASE + i * 3 + j);
}
function buildFaceContact(faceAxis: number, refIsB: boolean, margin: number, out: ContactResult): void {
    const { refPosition, refAxes, refHalf, incPosition, incAxes, incHalf } = face;
    vec3.scaleAndAdd(refCenter, refPosition, refNormal, refHalf[faceAxis]);
    let incAxisIndex = 0;
    let incSign = 1;
    let bestAlignment = -Infinity;
    for (let k = 0; k < 3; k++) {
        const alignment = vec3.dot(incAxes[k], refNormal);
        if (Math.abs(alignment) > bestAlignment) {
            bestAlignment = Math.abs(alignment);
            incAxisIndex = k;
            incSign = alignment > 0 ? -1 : 1;
        }
    }
    vec3.scale(incNormal, incAxes[incAxisIndex], incSign);
    vec3.scaleAndAdd(incCenter, incPosition, incNormal, incHalf[incAxisIndex]);
    const uIndex = (incAxisIndex + 1) % 3;
    const vIndex = (incAxisIndex + 2) % 3;
    const u = incAxes[uIndex];
    const v = incAxes[vIndex];
    const hu = incHalf[uIndex];
    const hv = incHalf[vIndex];
    let count = 0;
    count = pushVertex(polygonA, idsA, cornersA, count, incCenter, u, hu, v, hv, 0);
    count = pushVertex(polygonA, idsA, cornersA, count, incCenter, u, -hu, v, hv, 1);
    count = pushVertex(polygonA, idsA, cornersA, count, incCenter, u, -hu, v, -hv, 2);
    count = pushVertex(polygonA, idsA, cornersA, count, incCenter, u, hu, v, -hv, 3);
    const side1 = refAxes[(faceAxis + 1) % 3];
    const side2 = refAxes[(faceAxis + 2) % 3];
    const h1 = refHalf[(faceAxis + 1) % 3];
    const h2 = refHalf[(faceAxis + 2) % 3];
    count = clipPolygon(polygonA, idsA, cornersA, count, polygonB, idsB, cornersB, side1, 1, h1, 0);
    count = clipPolygon(polygonB, idsB, cornersB, count, polygonA, idsA, cornersA, side1, -1, h1, 1);
    count = clipPolygon(polygonA, idsA, cornersA, count, polygonB, idsB, cornersB, side2, 1, h2, 2);
    count = clipPolygon(polygonB, idsB, cornersB, count, polygonA, idsA, cornersA, side2, -1, h2, 3);
    const idFlags = (refIsB ? 1 << 5 : 0) | (faceAxis << 6) | (incAxisIndex << 8);
    let candidateCount = 0;
    for (let i = 0; i < count; i++) {
        const x = polygonA[i * 3];
        const y = polygonA[i * 3 + 1];
        const z = polygonA[i * 3 + 2];
        const separation = (x - refCenter[0]) * refNormal[0] + (y - refCenter[1]) * refNormal[1] + (z - refCenter[2]) * refNormal[2];
        if (separation > margin)
            continue;
        const half = separation * 0.5;
        candidatePositions[candidateCount * 3] = x - refNormal[0] * half;
        candidatePositions[candidateCount * 3 + 1] = y - refNormal[1] * half;
        candidatePositions[candidateCount * 3 + 2] = z - refNormal[2] * half;
        candidateSeparations[candidateCount] = separation;
        candidateIds[candidateCount] = idsA[i] | idFlags;
        candidateCount++;
    }
    if (candidateCount === 0)
        return;
    vec3.scale(out.normal, refNormal, refIsB ? -1 : 1);
    if (candidateCount <= MAX_MANIFOLD_POINTS) {
        for (let i = 0; i < candidateCount; i++)
            emitCandidate(i, out);
        return;
    }
    reduceCandidates(candidateCount, out);
}
function pushVertex(positions: Float32Array, ids: Int32Array, corners: Int32Array, count: number, center: Vec3, u: Vec3, su: number, v: Vec3, sv: number, corner: number): number {
    positions[count * 3] = center[0] + u[0] * su + v[0] * sv;
    positions[count * 3 + 1] = center[1] + u[1] * su + v[1] * sv;
    positions[count * 3 + 2] = center[2] + u[2] * su + v[2] * sv;
    ids[count] = corner;
    corners[count] = corner;
    return count + 1;
}
function clipPolygon(inPositions: Float32Array, inIds: Int32Array, inCorners: Int32Array, inCount: number, outPositions: Float32Array, outIds: Int32Array, outCorners: Int32Array, axis: Vec3, sign: number, h: number, planeIndex: number): number {
    let outCount = 0;
    for (let i = 0; i < inCount; i++) {
        const next = (i + 1) % inCount;
        const ix = inPositions[i * 3], iy = inPositions[i * 3 + 1], iz = inPositions[i * 3 + 2];
        const nx = inPositions[next * 3], ny = inPositions[next * 3 + 1], nz = inPositions[next * 3 + 2];
        const di = sign * ((ix - refCenter[0]) * axis[0] + (iy - refCenter[1]) * axis[1] + (iz - refCenter[2]) * axis[2]) - h;
        const dn = sign * ((nx - refCenter[0]) * axis[0] + (ny - refCenter[1]) * axis[1] + (nz - refCenter[2]) * axis[2]) - h;
        const insideI = di <= 0;
        const insideN = dn <= 0;
        if (insideI && outCount < MAX_CLIP_VERTICES) {
            outPositions[outCount * 3] = ix;
            outPositions[outCount * 3 + 1] = iy;
            outPositions[outCount * 3 + 2] = iz;
            outIds[outCount] = inIds[i];
            outCorners[outCount] = inCorners[i];
            outCount++;
        }
        if (insideI !== insideN && outCount < MAX_CLIP_VERTICES) {
            const fraction = di / (di - dn);
            outPositions[outCount * 3] = ix + (nx - ix) * fraction;
            outPositions[outCount * 3 + 1] = iy + (ny - iy) * fraction;
            outPositions[outCount * 3 + 2] = iz + (nz - iz) * fraction;
            outIds[outCount] = 4 * (planeIndex + 1) + inCorners[i];
            outCorners[outCount] = inCorners[i];
            outCount++;
        }
    }
    return outCount;
}
function emitCandidate(index: number, out: ContactResult): void {
    out.add(candidatePositions[index * 3], candidatePositions[index * 3 + 1], candidatePositions[index * 3 + 2], candidateSeparations[index], candidateIds[index]);
}
function reduceCandidates(count: number, out: ContactResult): void {
    let deepest = 0;
    for (let i = 1; i < count; i++) {
        if (candidateSeparations[i] < candidateSeparations[deepest])
            deepest = i;
    }
    chosen[0] = deepest;
    const p0x = candidatePositions[deepest * 3], p0y = candidatePositions[deepest * 3 + 1], p0z = candidatePositions[deepest * 3 + 2];
    let farthest = -1;
    let farthestDistance = -1;
    for (let i = 0; i < count; i++) {
        if (i === deepest)
            continue;
        const dx = candidatePositions[i * 3] - p0x;
        const dy = candidatePositions[i * 3 + 1] - p0y;
        const dz = candidatePositions[i * 3 + 2] - p0z;
        const distance = dx * dx + dy * dy + dz * dz;
        if (distance > farthestDistance) {
            farthestDistance = distance;
            farthest = i;
        }
    }
    chosen[1] = farthest;
    const ex = candidatePositions[farthest * 3] - p0x;
    const ey = candidatePositions[farthest * 3 + 1] - p0y;
    const ez = candidatePositions[farthest * 3 + 2] - p0z;
    let positive = -1;
    let positiveArea = 0;
    let negative = -1;
    let negativeArea = 0;
    for (let i = 0; i < count; i++) {
        if (i === deepest || i === farthest) {
            candidateAreas[i] = 0;
            continue;
        }
        const dx = candidatePositions[i * 3] - p0x;
        const dy = candidatePositions[i * 3 + 1] - p0y;
        const dz = candidatePositions[i * 3 + 2] - p0z;
        const cx = ey * dz - ez * dy;
        const cy = ez * dx - ex * dz;
        const cz = ex * dy - ey * dx;
        const area = cx * refNormal[0] + cy * refNormal[1] + cz * refNormal[2];
        candidateAreas[i] = area;
        if (area > positiveArea) {
            positiveArea = area;
            positive = i;
        }
        if (area < negativeArea) {
            negativeArea = area;
            negative = i;
        }
    }
    let chosenCount = 2;
    if (positive >= 0)
        chosen[chosenCount++] = positive;
    if (negative >= 0)
        chosen[chosenCount++] = negative;
    while (chosenCount < MAX_MANIFOLD_POINTS) {
        let best = -1;
        let bestArea = -1;
        for (let i = 0; i < count; i++) {
            if (isChosen(i, chosenCount))
                continue;
            const area = Math.abs(candidateAreas[i]);
            if (area > bestArea) {
                bestArea = area;
                best = i;
            }
        }
        if (best < 0)
            break;
        chosen[chosenCount++] = best;
    }
    for (let i = 0; i < chosenCount; i++)
        emitCandidate(chosen[i], out);
}
function isChosen(index: number, chosenCount: number): boolean {
    for (let i = 0; i < chosenCount; i++) {
        if (chosen[i] === index)
            return true;
    }
    return false;
}
