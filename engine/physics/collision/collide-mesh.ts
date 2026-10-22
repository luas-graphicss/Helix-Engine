import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import type { BoxShape, CapsuleShape, MeshShape, SphereShape } from '@/engine/physics/shapes/collider-shape';
import type { TriangleMeshBvh } from '@/engine/physics/shapes/triangle-mesh-bvh';
import { capsuleSegment } from './collide-sphere';
import { closestPointsSegmentSegment } from './closest-points';
import { MAX_MANIFOLD_POINTS, type ContactResult } from './manifold';
const SAME_SURFACE_COSINE = 0.85;
const MAX_CANDIDATES = 48;
const DEGENERATE_DISTANCE = 1e-6;
const PROJECTION_TOLERANCE = 1e-4;
const DUPLICATE_DISTANCE_SQUARED = 1e-6;
const BOX_CORNERS = 8;
const VERTEX_ID_FLAG = 0x40000000;
const enum CandidateKind {
    ShapePoint,
    MeshVertex
}
const shapePoints: Vec3[] = [];
const surfaces: Vec3[] = [];
const normals: Vec3[] = [];
const separations = new Float32Array(MAX_CANDIDATES);
const ids = new Int32Array(MAX_CANDIDATES);
const kinds = new Uint8Array(MAX_CANDIDATES);
const behind = new Uint8Array(MAX_CANDIDATES);
const order = new Int32Array(MAX_CANDIDATES);
for (let i = 0; i < MAX_CANDIDATES; i++) {
    shapePoints.push(vec3.create());
    surfaces.push(vec3.create());
    normals.push(vec3.create());
}
let candidateCount = 0;
let currentBvh: TriangleMeshBvh | null = null;
let currentRadius = 0;
let currentMargin = 0;
let currentTriangle = 0;
const triA = vec3.create();
const triB = vec3.create();
const triC = vec3.create();
const triNormal = vec3.create();
const edgeAB = vec3.create();
const edgeAC = vec3.create();
const edgeBC = vec3.create();
const toPoint = vec3.create();
const closest = vec3.create();
const delta = vec3.create();
const probeSurface = vec3.create();
const probeNormal = vec3.create();
const localCenter = vec3.create();
const localStart = vec3.create();
const localEnd = vec3.create();
const segmentStart = vec3.create();
const segmentEnd = vec3.create();
const segmentPoint = vec3.create();
const trianglePoint = vec3.create();
const crossing = vec3.create();
const edgeClosestA = vec3.create();
const edgeClosestB = vec3.create();
const queryMin = vec3.create();
const queryMax = vec3.create();
const worldPoint = vec3.create();
const worldNormal = vec3.create();
const sharedNormal = vec3.create();
const axis = vec3.create();
const boxLocal = vec3.create();
const boxLocalPosition = vec3.create();
const boxLocalRotation = mat3.create();
const meshRotationTransposed = mat3.create();
const boxHalfExtents = vec3.create();
const corners: Vec3[] = [];
for (let i = 0; i < BOX_CORNERS; i++)
    corners.push(vec3.create());
function toLocal(out: Vec3, meshPosition: Vec3, meshRotation: Mat3, world: Vec3): Vec3 {
    vec3.subtract(out, world, meshPosition);
    return mat3.transformVec3Transposed(out, meshRotation, out);
}
function toWorld(out: Vec3, meshPosition: Vec3, meshRotation: Mat3, local: Vec3): Vec3 {
    mat3.transformVec3(out, meshRotation, local);
    return vec3.add(out, out, meshPosition);
}
function transpose(out: Mat3, m: Mat3): Mat3 {
    out[0] = m[0];
    out[1] = m[3];
    out[2] = m[6];
    out[3] = m[1];
    out[4] = m[4];
    out[5] = m[7];
    out[6] = m[2];
    out[7] = m[5];
    out[8] = m[8];
    return out;
}
function fillTriangle(bvh: TriangleMeshBvh, index: number): boolean {
    bvh.triangle(index, triA, triB, triC);
    vec3.subtract(edgeAB, triB, triA);
    vec3.subtract(edgeAC, triC, triA);
    vec3.cross(triNormal, edgeAB, edgeAC);
    const length = vec3.length(triNormal);
    if (length < DEGENERATE_DISTANCE)
        return false;
    vec3.scale(triNormal, triNormal, 1 / length);
    currentTriangle = index;
    return true;
}
function closestPointOnTriangle(out: Vec3, p: Vec3): Vec3 {
    vec3.subtract(edgeAB, triB, triA);
    vec3.subtract(edgeAC, triC, triA);
    vec3.subtract(toPoint, p, triA);
    const d1 = vec3.dot(edgeAB, toPoint);
    const d2 = vec3.dot(edgeAC, toPoint);
    if (d1 <= 0 && d2 <= 0)
        return vec3.copy(out, triA);
    vec3.subtract(toPoint, p, triB);
    const d3 = vec3.dot(edgeAB, toPoint);
    const d4 = vec3.dot(edgeAC, toPoint);
    if (d3 >= 0 && d4 <= d3)
        return vec3.copy(out, triB);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0)
        return vec3.scaleAndAdd(out, triA, edgeAB, d1 / (d1 - d3));
    vec3.subtract(toPoint, p, triC);
    const d5 = vec3.dot(edgeAB, toPoint);
    const d6 = vec3.dot(edgeAC, toPoint);
    if (d6 >= 0 && d5 <= d6)
        return vec3.copy(out, triC);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0)
        return vec3.scaleAndAdd(out, triA, edgeAC, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        vec3.subtract(edgeBC, triC, triB);
        return vec3.scaleAndAdd(out, triB, edgeBC, (d4 - d3) / (d4 - d3 + (d5 - d6)));
    }
    const denominator = 1 / (va + vb + vc);
    vec3.scaleAndAdd(out, triA, edgeAB, vb * denominator);
    return vec3.scaleAndAdd(out, out, edgeAC, vc * denominator);
}
function insideTriangle(p: Vec3): boolean {
    vec3.subtract(edgeAB, triB, triA);
    vec3.subtract(toPoint, p, triA);
    vec3.cross(closest, edgeAB, toPoint);
    if (vec3.dot(closest, triNormal) < 0)
        return false;
    vec3.subtract(edgeBC, triC, triB);
    vec3.subtract(toPoint, p, triB);
    vec3.cross(closest, edgeBC, toPoint);
    if (vec3.dot(closest, triNormal) < 0)
        return false;
    vec3.subtract(edgeAC, triA, triC);
    vec3.subtract(toPoint, p, triC);
    vec3.cross(closest, edgeAC, toPoint);
    return vec3.dot(closest, triNormal) >= 0;
}
let probeBehind = false;
function probePoint(p: Vec3): number {
    closestPointOnTriangle(probeSurface, p);
    vec3.subtract(delta, p, probeSurface);
    const distance = vec3.length(delta);
    vec3.subtract(toPoint, p, triA);
    const signed = vec3.dot(toPoint, triNormal);
    if (signed >= 0) {
        probeBehind = false;
        if (distance > DEGENERATE_DISTANCE)
            vec3.scale(probeNormal, delta, 1 / distance);
        else
            vec3.copy(probeNormal, triNormal);
        return distance;
    }
    if (distance + signed > PROJECTION_TOLERANCE * Math.max(1, distance))
        return NaN;
    probeBehind = true;
    vec3.copy(probeNormal, triNormal);
    return signed;
}
let pierced = false;
function closestSegmentTriangle(a: Vec3, b: Vec3): number {
    pierced = false;
    vec3.subtract(toPoint, a, triA);
    const da = vec3.dot(toPoint, triNormal);
    vec3.subtract(toPoint, b, triA);
    const db = vec3.dot(toPoint, triNormal);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        crossing[0] = a[0] + (b[0] - a[0]) * t;
        crossing[1] = a[1] + (b[1] - a[1]) * t;
        crossing[2] = a[2] + (b[2] - a[2]) * t;
        if (insideTriangle(crossing)) {
            pierced = true;
            vec3.copy(segmentPoint, crossing);
            vec3.copy(trianglePoint, crossing);
            return 0;
        }
    }
    let best = Infinity;
    closestPointOnTriangle(closest, a);
    vec3.subtract(delta, a, closest);
    best = vec3.dot(delta, delta);
    vec3.copy(segmentPoint, a);
    vec3.copy(trianglePoint, closest);
    closestPointOnTriangle(closest, b);
    vec3.subtract(delta, b, closest);
    let squared = vec3.dot(delta, delta);
    if (squared < best) {
        best = squared;
        vec3.copy(segmentPoint, b);
        vec3.copy(trianglePoint, closest);
    }
    squared = closestPointsSegmentSegment(a, b, triA, triB, edgeClosestA, edgeClosestB);
    if (squared < best) {
        best = squared;
        vec3.copy(segmentPoint, edgeClosestA);
        vec3.copy(trianglePoint, edgeClosestB);
    }
    squared = closestPointsSegmentSegment(a, b, triB, triC, edgeClosestA, edgeClosestB);
    if (squared < best) {
        best = squared;
        vec3.copy(segmentPoint, edgeClosestA);
        vec3.copy(trianglePoint, edgeClosestB);
    }
    squared = closestPointsSegmentSegment(a, b, triC, triA, edgeClosestA, edgeClosestB);
    if (squared < best) {
        best = squared;
        vec3.copy(segmentPoint, edgeClosestA);
        vec3.copy(trianglePoint, edgeClosestB);
    }
    return Math.sqrt(best);
}
function findCandidate(id: number): number {
    for (let i = 0; i < candidateCount; i++)
        if (ids[i] === id)
            return i;
    return -1;
}
function pushCandidate(shapePoint: Vec3, surface: Vec3, normal: Vec3, separation: number, isBehind: boolean, kind: CandidateKind, id: number): void {
    let index = findCandidate(id);
    if (index >= 0) {
        const deeper = isBehind !== (behind[index] === 1) ? isBehind : separation < separations[index];
        if (!deeper)
            return;
    }
    else {
        if (candidateCount >= MAX_CANDIDATES)
            return;
        index = candidateCount++;
    }
    vec3.copy(shapePoints[index], shapePoint);
    vec3.copy(surfaces[index], surface);
    vec3.copy(normals[index], normal);
    separations[index] = separation;
    behind[index] = isBehind ? 1 : 0;
    kinds[index] = kind;
    ids[index] = id;
}
function chooseAnchor(): number {
    let anchor = -1;
    for (let i = 0; i < candidateCount; i++) {
        if (behind[i] === 0)
            continue;
        if (anchor < 0 || separations[i] > separations[anchor])
            anchor = i;
    }
    if (anchor >= 0)
        return anchor;
    for (let i = 0; i < candidateCount; i++) {
        if (anchor < 0 || separations[i] < separations[anchor])
            anchor = i;
    }
    return anchor;
}
function isDuplicate(index: number, kept: number): boolean {
    for (let j = 0; j < kept; j++) {
        vec3.subtract(delta, surfaces[index], surfaces[order[j]]);
        if (vec3.dot(delta, delta) < DUPLICATE_DISTANCE_SQUARED)
            return true;
    }
    return false;
}
function sortKept(kept: number): void {
    for (let i = 2; i < kept; i++) {
        const current = order[i];
        let j = i - 1;
        while (j >= 1 && separations[order[j]] > separations[current]) {
            order[j + 1] = order[j];
            j--;
        }
        order[j + 1] = current;
    }
}
function emitProbeContacts(radius: number, margin: number, meshPosition: Vec3, meshRotation: Mat3, out: ContactResult): void {
    if (candidateCount === 0)
        return;
    const anchor = chooseAnchor();
    vec3.copy(sharedNormal, normals[anchor]);
    order[0] = anchor;
    let kept = 1;
    for (let i = 0; i < candidateCount; i++) {
        if (i === anchor)
            continue;
        if (vec3.dot(normals[i], sharedNormal) < SAME_SURFACE_COSINE)
            continue;
        vec3.subtract(delta, shapePoints[i], surfaces[i]);
        const separation = vec3.dot(delta, sharedNormal) - radius;
        if (separation > margin || isDuplicate(i, kept))
            continue;
        separations[i] = separation;
        order[kept++] = i;
    }
    vec3.subtract(delta, shapePoints[anchor], surfaces[anchor]);
    separations[anchor] = vec3.dot(delta, sharedNormal) - radius;
    sortKept(kept);
    mat3.transformVec3(worldNormal, meshRotation, sharedNormal);
    vec3.scale(out.normal, worldNormal, -1);
    const emitted = Math.min(kept, MAX_MANIFOLD_POINTS);
    for (let i = 0; i < emitted; i++) {
        const index = order[i];
        const surface = surfaces[index];
        const center = shapePoints[index];
        closest[0] = (surface[0] + center[0] - sharedNormal[0] * radius) * 0.5;
        closest[1] = (surface[1] + center[1] - sharedNormal[1] * radius) * 0.5;
        closest[2] = (surface[2] + center[2] - sharedNormal[2] * radius) * 0.5;
        toWorld(worldPoint, meshPosition, meshRotation, closest);
        out.add(worldPoint[0], worldPoint[1], worldPoint[2], separations[index], ids[index]);
    }
}
function visitSphere(triangle: number): void {
    if (!currentBvh || !fillTriangle(currentBvh, triangle))
        return;
    const signed = probePoint(localCenter);
    if (Number.isNaN(signed))
        return;
    const separation = signed - currentRadius;
    if (!probeBehind && separation > currentMargin)
        return;
    pushCandidate(localCenter, probeSurface, probeNormal, separation, probeBehind, CandidateKind.ShapePoint, triangle);
}
export function collideSphereMesh(center: Vec3, sphere: SphereShape, meshPosition: Vec3, meshRotation: Mat3, mesh: MeshShape, margin: number, out: ContactResult): void {
    toLocal(localCenter, meshPosition, meshRotation, center);
    const reach = sphere.radius + margin;
    vec3.set(queryMin, localCenter[0] - reach, localCenter[1] - reach, localCenter[2] - reach);
    vec3.set(queryMax, localCenter[0] + reach, localCenter[1] + reach, localCenter[2] + reach);
    candidateCount = 0;
    currentBvh = mesh.bvh;
    currentRadius = sphere.radius;
    currentMargin = margin;
    mesh.bvh.queryAabb(queryMin, queryMax, visitSphere);
    currentBvh = null;
    if (candidateCount === 0)
        return;
    const anchor = chooseAnchor();
    order[0] = anchor;
    candidateCount = 1;
    if (anchor !== 0) {
        vec3.copy(shapePoints[0], shapePoints[anchor]);
        vec3.copy(surfaces[0], surfaces[anchor]);
        vec3.copy(normals[0], normals[anchor]);
        separations[0] = separations[anchor];
        behind[0] = behind[anchor];
        ids[0] = ids[anchor];
    }
    emitProbeContacts(sphere.radius, margin, meshPosition, meshRotation, out);
}
function visitCapsule(triangle: number): void {
    if (!currentBvh || !fillTriangle(currentBvh, triangle))
        return;
    closestSegmentTriangle(localStart, localEnd);
    if (pierced) {
        vec3.subtract(toPoint, localStart, triA);
        const da = vec3.dot(toPoint, triNormal);
        vec3.subtract(toPoint, localEnd, triA);
        const db = vec3.dot(toPoint, triNormal);
        const deepest = da < db ? localStart : localEnd;
        const depth = -Math.min(da, db);
        vec3.scaleAndAdd(probeSurface, deepest, triNormal, depth);
        pushCandidate(deepest, probeSurface, triNormal, -depth - currentRadius, true, CandidateKind.ShapePoint, triangle);
        return;
    }
    const signed = probePoint(segmentPoint);
    if (Number.isNaN(signed))
        return;
    const separation = signed - currentRadius;
    if (!probeBehind && separation > currentMargin)
        return;
    pushCandidate(segmentPoint, probeSurface, probeNormal, separation, probeBehind, CandidateKind.ShapePoint, triangle);
}
export function collideCapsuleMesh(position: Vec3, rotation: Mat3, capsule: CapsuleShape, meshPosition: Vec3, meshRotation: Mat3, mesh: MeshShape, margin: number, out: ContactResult): void {
    capsuleSegment(segmentStart, segmentEnd, position, rotation, capsule);
    toLocal(localStart, meshPosition, meshRotation, segmentStart);
    toLocal(localEnd, meshPosition, meshRotation, segmentEnd);
    const reach = capsule.radius + margin;
    for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
        queryMin[axisIndex] = Math.min(localStart[axisIndex], localEnd[axisIndex]) - reach;
        queryMax[axisIndex] = Math.max(localStart[axisIndex], localEnd[axisIndex]) + reach;
    }
    candidateCount = 0;
    currentBvh = mesh.bvh;
    currentRadius = capsule.radius;
    currentMargin = margin;
    mesh.bvh.queryAabb(queryMin, queryMax, visitCapsule);
    currentBvh = null;
    emitProbeContacts(capsule.radius, margin, meshPosition, meshRotation, out);
}
function boxSupport(out: Vec3, direction: Vec3): Vec3 {
    vec3.copy(out, boxLocalPosition);
    for (let k = 0; k < 3; k++) {
        mat3.getColumn(axis, boxLocalRotation, k as 0 | 1 | 2);
        const sign = vec3.dot(axis, direction) >= 0 ? 1 : -1;
        vec3.scaleAndAdd(out, out, axis, sign * boxHalfExtents[k]);
    }
    return out;
}
function boxCandidateSeparation(index: number, normal: Vec3): number {
    if (kinds[index] === CandidateKind.MeshVertex) {
        vec3.scale(delta, normal, -1);
        boxSupport(shapePoints[index], delta);
    }
    vec3.subtract(delta, shapePoints[index], surfaces[index]);
    return vec3.dot(delta, normal);
}
function visitBox(triangle: number): void {
    if (!currentBvh || !fillTriangle(currentBvh, triangle))
        return;
    for (let corner = 0; corner < BOX_CORNERS; corner++) {
        const signed = probePoint(corners[corner]);
        if (Number.isNaN(signed))
            continue;
        if (!probeBehind && signed > currentMargin)
            continue;
        pushCandidate(corners[corner], probeSurface, probeNormal, signed, probeBehind, CandidateKind.ShapePoint, corner);
    }
    const { indices } = currentBvh;
    for (let k = 0; k < 3; k++) {
        const vertex = k === 0 ? triA : k === 1 ? triB : triC;
        vec3.subtract(delta, vertex, boxLocalPosition);
        mat3.transformVec3Transposed(boxLocal, boxLocalRotation, delta);
        if (Math.abs(boxLocal[0]) > boxHalfExtents[0] || Math.abs(boxLocal[1]) > boxHalfExtents[1] || Math.abs(boxLocal[2]) > boxHalfExtents[2])
            continue;
        const id = VERTEX_ID_FLAG | indices[triangle * 3 + k];
        if (findCandidate(id) >= 0)
            continue;
        pushCandidate(vertex, vertex, triNormal, 0, false, CandidateKind.MeshVertex, id);
    }
}
export function collideBoxMesh(position: Vec3, rotation: Mat3, box: BoxShape, meshPosition: Vec3, meshRotation: Mat3, mesh: MeshShape, margin: number, out: ContactResult): void {
    toLocal(boxLocalPosition, meshPosition, meshRotation, position);
    transpose(meshRotationTransposed, meshRotation);
    mat3.multiply(boxLocalRotation, meshRotationTransposed, rotation);
    vec3.copy(boxHalfExtents, box.halfExtents);
    vec3.set(queryMin, Infinity, Infinity, Infinity);
    vec3.set(queryMax, -Infinity, -Infinity, -Infinity);
    for (let corner = 0; corner < BOX_CORNERS; corner++) {
        const point = corners[corner];
        vec3.copy(point, boxLocalPosition);
        for (let k = 0; k < 3; k++) {
            mat3.getColumn(axis, boxLocalRotation, k as 0 | 1 | 2);
            vec3.scaleAndAdd(point, point, axis, (corner >> k) & 1 ? boxHalfExtents[k] : -boxHalfExtents[k]);
        }
        for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
            if (point[axisIndex] < queryMin[axisIndex])
                queryMin[axisIndex] = point[axisIndex];
            if (point[axisIndex] > queryMax[axisIndex])
                queryMax[axisIndex] = point[axisIndex];
        }
    }
    for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
        queryMin[axisIndex] -= margin;
        queryMax[axisIndex] += margin;
    }
    candidateCount = 0;
    currentBvh = mesh.bvh;
    currentMargin = margin;
    mesh.bvh.queryAabb(queryMin, queryMax, visitBox);
    currentBvh = null;
    if (candidateCount === 0)
        return;
    let deepestCorner = Infinity;
    for (let i = 0; i < candidateCount; i++) {
        if (kinds[i] === CandidateKind.ShapePoint)
            deepestCorner = Math.min(deepestCorner, separations[i]);
    }
    const vertexGate = deepestCorner - Math.max(margin, 0);
    let accepted = 0;
    for (let i = 0; i < candidateCount; i++) {
        if (kinds[i] === CandidateKind.MeshVertex) {
            separations[i] = boxCandidateSeparation(i, normals[i]);
            if (separations[i] > margin || separations[i] >= vertexGate)
                continue;
        }
        order[accepted++] = i;
    }
    if (accepted === 0)
        return;
    vec3.set(sharedNormal, 0, 0, 0);
    let deepest = order[0];
    for (let j = 0; j < accepted; j++) {
        const i = order[j];
        if (separations[i] < separations[deepest])
            deepest = i;
        vec3.scaleAndAdd(sharedNormal, sharedNormal, normals[i], Math.max(margin - separations[i], 1e-3));
    }
    if (vec3.length(sharedNormal) < DEGENERATE_DISTANCE)
        vec3.copy(sharedNormal, normals[deepest]);
    vec3.normalize(sharedNormal, sharedNormal);
    let kept = 0;
    for (let j = 0; j < accepted; j++) {
        const i = order[j];
        const separation = boxCandidateSeparation(i, sharedNormal);
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
    mat3.transformVec3(worldNormal, meshRotation, sharedNormal);
    vec3.scale(out.normal, worldNormal, -1);
    const emitted = Math.min(kept, MAX_MANIFOLD_POINTS);
    for (let i = 0; i < emitted; i++) {
        const index = order[i];
        const surface = surfaces[index];
        if (kinds[index] === CandidateKind.MeshVertex) {
            toWorld(worldPoint, meshPosition, meshRotation, surface);
        }
        else {
            const point = shapePoints[index];
            closest[0] = (surface[0] + point[0]) * 0.5;
            closest[1] = (surface[1] + point[1]) * 0.5;
            closest[2] = (surface[2] + point[2]) * 0.5;
            toWorld(worldPoint, meshPosition, meshRotation, closest);
        }
        out.add(worldPoint[0], worldPoint[1], worldPoint[2], separations[index], ids[index]);
    }
}
