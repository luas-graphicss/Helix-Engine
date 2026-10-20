import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import type { BoxShape, CapsuleShape } from '@/engine/physics/shapes/collider-shape';
import { closestPointOnBoxSurface, closestPointOnSegment, closestPointsSegmentSegment, tangentBasis } from './closest-points';
import { capsuleSegment, collideSpherePoints } from './collide-sphere';
import type { ContactResult } from './manifold';
const PARALLEL_COSINE = 0.98;
const MIN_OVERLAP = 0.01;
const GOLDEN_ITERATIONS = 24;
const GOLDEN_RATIO = 0.6180339887498949;
const INTERIOR_T_EPSILON = 0.02;
const SAME_FACE_COSINE = 0.99;
const a0 = vec3.create();
const a1 = vec3.create();
const b0 = vec3.create();
const b1 = vec3.create();
const axisA = vec3.create();
const axisB = vec3.create();
const closestA = vec3.create();
const closestB = vec3.create();
const midA = vec3.create();
const midB = vec3.create();
const normal = vec3.create();
const unusedTangent = vec3.create();
const relative = vec3.create();
const scratch = vec3.create();
const localStart = vec3.create();
const localEnd = vec3.create();
const localPoint = vec3.create();
const localSurface = vec3.create();
const localNormal = vec3.create();
const worldNormal = vec3.create();
const boxSurface = vec3.create();
export function collideCapsuleCapsule(positionA: Vec3, rotationA: Mat3, capsuleA: CapsuleShape, positionB: Vec3, rotationB: Mat3, capsuleB: CapsuleShape, margin: number, out: ContactResult): void {
    capsuleSegment(a0, a1, positionA, rotationA, capsuleA);
    capsuleSegment(b0, b1, positionB, rotationB, capsuleB);
    const lengthA = 2 * capsuleA.halfHeight;
    const lengthB = 2 * capsuleB.halfHeight;
    if (lengthA > MIN_OVERLAP && lengthB > MIN_OVERLAP) {
        vec3.subtract(axisA, a1, a0);
        vec3.scale(axisA, axisA, 1 / lengthA);
        vec3.subtract(axisB, b1, b0);
        vec3.scale(axisB, axisB, 1 / lengthB);
        if (Math.abs(vec3.dot(axisA, axisB)) > PARALLEL_COSINE && collideParallelCapsules(capsuleA, capsuleB, lengthA, margin, out))
            return;
    }
    closestPointsSegmentSegment(a0, a1, b0, b1, closestA, closestB);
    collideSpherePoints(closestA, capsuleA.radius, closestB, capsuleB.radius, margin, 0, out);
}
function collideParallelCapsules(capsuleA: CapsuleShape, capsuleB: CapsuleShape, lengthA: number, margin: number, out: ContactResult): boolean {
    vec3.subtract(relative, b0, a0);
    const t0 = vec3.dot(relative, axisA);
    vec3.subtract(relative, b1, a0);
    const t1 = vec3.dot(relative, axisA);
    const low = Math.max(0, Math.min(t0, t1));
    const high = Math.min(lengthA, Math.max(t0, t1));
    if (high - low < MIN_OVERLAP)
        return false;
    vec3.scaleAndAdd(midA, a0, axisA, (low + high) * 0.5);
    closestPointOnSegment(midB, b0, b1, midA);
    vec3.subtract(normal, midB, midA);
    const distance = vec3.length(normal);
    if (distance > 1e-6) {
        vec3.scale(normal, normal, 1 / distance);
    }
    else {
        tangentBasis(normal, unusedTangent, axisA);
    }
    vec3.copy(out.normal, normal);
    const radiusA = capsuleA.radius;
    const radiusB = capsuleB.radius;
    for (let i = 0; i < 2; i++) {
        vec3.scaleAndAdd(closestA, a0, axisA, i === 0 ? low : high);
        closestPointOnSegment(closestB, b0, b1, closestA);
        vec3.subtract(scratch, closestB, closestA);
        const separation = vec3.dot(scratch, normal) - radiusA - radiusB;
        if (separation > margin)
            continue;
        const offset = radiusA + separation * 0.5;
        out.add(closestA[0] + normal[0] * offset, closestA[1] + normal[1] * offset, closestA[2] + normal[2] * offset, separation, i);
    }
    return out.count > 0;
}
function segmentToBoxDistance(t: number, halfExtents: Vec3): number {
    localPoint[0] = localStart[0] + (localEnd[0] - localStart[0]) * t;
    localPoint[1] = localStart[1] + (localEnd[1] - localStart[1]) * t;
    localPoint[2] = localStart[2] + (localEnd[2] - localStart[2]) * t;
    return closestPointOnBoxSurface(localSurface, localNormal, localPoint, halfExtents);
}
function closestSegmentParameterToBox(halfExtents: Vec3): number {
    let low = 0;
    let high = 1;
    let c = high - GOLDEN_RATIO * (high - low);
    let d = low + GOLDEN_RATIO * (high - low);
    let fc = segmentToBoxDistance(c, halfExtents);
    let fd = segmentToBoxDistance(d, halfExtents);
    for (let i = 0; i < GOLDEN_ITERATIONS; i++) {
        if (fc < fd) {
            high = d;
            d = c;
            fd = fc;
            c = high - GOLDEN_RATIO * (high - low);
            fc = segmentToBoxDistance(c, halfExtents);
        }
        else {
            low = c;
            c = d;
            fc = fd;
            d = low + GOLDEN_RATIO * (high - low);
            fd = segmentToBoxDistance(d, halfExtents);
        }
    }
    return (low + high) * 0.5;
}
const candidateT = new Float32Array(3);
const candidateSeparation = new Float32Array(3);
const candidateNormals = [vec3.create(), vec3.create(), vec3.create()];
const candidateSurfaces = [vec3.create(), vec3.create(), vec3.create()];
export function collideCapsuleBox(positionA: Vec3, rotationA: Mat3, capsule: CapsuleShape, positionB: Vec3, rotationB: Mat3, box: BoxShape, margin: number, out: ContactResult): void {
    capsuleSegment(a0, a1, positionA, rotationA, capsule);
    vec3.subtract(scratch, a0, positionB);
    mat3.transformVec3Transposed(localStart, rotationB, scratch);
    vec3.subtract(scratch, a1, positionB);
    mat3.transformVec3Transposed(localEnd, rotationB, scratch);
    let candidateCount = 2;
    candidateT[0] = 0;
    candidateT[1] = 1;
    if (capsule.halfHeight > 0) {
        const interior = closestSegmentParameterToBox(box.halfExtents);
        if (interior > INTERIOR_T_EPSILON && interior < 1 - INTERIOR_T_EPSILON)
            candidateT[candidateCount++] = interior;
    }
    let deepest = -1;
    let deepestSeparation = Infinity;
    for (let i = 0; i < candidateCount; i++) {
        const separation = segmentToBoxDistance(candidateT[i], box.halfExtents) - capsule.radius;
        candidateSeparation[i] = separation;
        vec3.copy(candidateNormals[i], localNormal);
        vec3.copy(candidateSurfaces[i], localSurface);
        if (separation < deepestSeparation) {
            deepestSeparation = separation;
            deepest = i;
        }
    }
    if (deepest < 0 || deepestSeparation > margin)
        return;
    const referenceNormal = candidateNormals[deepest];
    mat3.transformVec3(worldNormal, rotationB, referenceNormal);
    vec3.scale(out.normal, worldNormal, -1);
    for (let i = 0; i < candidateCount; i++) {
        if (candidateSeparation[i] > margin)
            continue;
        if (i !== deepest && vec3.dot(candidateNormals[i], referenceNormal) < SAME_FACE_COSINE)
            continue;
        mat3.transformVec3(boxSurface, rotationB, candidateSurfaces[i]);
        vec3.add(boxSurface, boxSurface, positionB);
        const t = candidateT[i];
        const capsuleX = a0[0] + (a1[0] - a0[0]) * t - worldNormal[0] * capsule.radius;
        const capsuleY = a0[1] + (a1[1] - a0[1]) * t - worldNormal[1] * capsule.radius;
        const capsuleZ = a0[2] + (a1[2] - a0[2]) * t - worldNormal[2] * capsule.radius;
        out.add((boxSurface[0] + capsuleX) * 0.5, (boxSurface[1] + capsuleY) * 0.5, (boxSurface[2] + capsuleZ) * 0.5, candidateSeparation[i], i);
    }
}
