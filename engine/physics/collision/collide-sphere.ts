import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import type { BoxShape, CapsuleShape, SphereShape } from '@/engine/physics/shapes/collider-shape';
import { closestPointOnBoxSurface, closestPointOnSegment } from './closest-points';
import type { ContactResult } from './manifold';
const DEGENERATE_DISTANCE = 1e-6;
const delta = vec3.create();
const segmentStart = vec3.create();
const segmentEnd = vec3.create();
const closest = vec3.create();
const localCenter = vec3.create();
const localSurface = vec3.create();
const localNormal = vec3.create();
const worldNormal = vec3.create();
const boxSurface = vec3.create();
export function collideSpherePoints(centerA: Vec3, radiusA: number, centerB: Vec3, radiusB: number, margin: number, id: number, out: ContactResult): void {
    vec3.subtract(delta, centerB, centerA);
    const distance = vec3.length(delta);
    const separation = distance - radiusA - radiusB;
    if (separation > margin)
        return;
    if (distance > DEGENERATE_DISTANCE) {
        vec3.scale(out.normal, delta, 1 / distance);
    }
    else {
        vec3.set(out.normal, 0, 1, 0);
    }
    const offset = radiusA + separation * 0.5;
    out.add(centerA[0] + out.normal[0] * offset, centerA[1] + out.normal[1] * offset, centerA[2] + out.normal[2] * offset, separation, id);
}
export function collideSphereSphere(centerA: Vec3, sphereA: SphereShape, centerB: Vec3, sphereB: SphereShape, margin: number, out: ContactResult): void {
    collideSpherePoints(centerA, sphereA.radius, centerB, sphereB.radius, margin, 0, out);
}
export function capsuleSegment(outStart: Vec3, outEnd: Vec3, position: Vec3, rotation: Mat3, capsule: CapsuleShape): void {
    const axisX = rotation[3] * capsule.halfHeight;
    const axisY = rotation[4] * capsule.halfHeight;
    const axisZ = rotation[5] * capsule.halfHeight;
    vec3.set(outStart, position[0] - axisX, position[1] - axisY, position[2] - axisZ);
    vec3.set(outEnd, position[0] + axisX, position[1] + axisY, position[2] + axisZ);
}
export function collideSphereCapsule(centerA: Vec3, sphere: SphereShape, positionB: Vec3, rotationB: Mat3, capsule: CapsuleShape, margin: number, out: ContactResult): void {
    capsuleSegment(segmentStart, segmentEnd, positionB, rotationB, capsule);
    closestPointOnSegment(closest, segmentStart, segmentEnd, centerA);
    collideSpherePoints(centerA, sphere.radius, closest, capsule.radius, margin, 0, out);
}
export function collideSphereBox(centerA: Vec3, sphere: SphereShape, positionB: Vec3, rotationB: Mat3, box: BoxShape, margin: number, out: ContactResult): void {
    vec3.subtract(delta, centerA, positionB);
    mat3.transformVec3Transposed(localCenter, rotationB, delta);
    const distance = closestPointOnBoxSurface(localSurface, localNormal, localCenter, box.halfExtents);
    const separation = distance - sphere.radius;
    if (separation > margin)
        return;
    mat3.transformVec3(worldNormal, rotationB, localNormal);
    vec3.scale(out.normal, worldNormal, -1);
    mat3.transformVec3(boxSurface, rotationB, localSurface);
    vec3.add(boxSurface, boxSurface, positionB);
    const sphereSurfaceX = centerA[0] - worldNormal[0] * sphere.radius;
    const sphereSurfaceY = centerA[1] - worldNormal[1] * sphere.radius;
    const sphereSurfaceZ = centerA[2] - worldNormal[2] * sphere.radius;
    out.add((boxSurface[0] + sphereSurfaceX) * 0.5, (boxSurface[1] + sphereSurfaceY) * 0.5, (boxSurface[2] + sphereSurfaceZ) * 0.5, separation, 0);
}
