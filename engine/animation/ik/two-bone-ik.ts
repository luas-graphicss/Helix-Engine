import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
export interface TwoBoneChain {
    readonly upper: Entity;
    readonly lower: Entity;
    readonly end: Entity;
}
const STRAIGHT_EPSILON = 1e-4;
const REACH_EPSILON = 1e-3;
const a = vec3.create();
const b = vec3.create();
const c = vec3.create();
const ab = vec3.create();
const ac = vec3.create();
const at = vec3.create();
const ba = vec3.create();
const bc = vec3.create();
const axis0 = vec3.create();
const axis1 = vec3.create();
const r0 = quat.create();
const r1 = quat.create();
const r2 = quat.create();
const worldUpper = quat.create();
const worldLower = quat.create();
const parentRotation = quat.create();
const nextWorld = quat.create();
const localRotation = quat.create();
const fallbackHint = vec3.create();
function angleBetween(u: Vec3, v: Vec3): number {
    const lengths = vec3.length(u) * vec3.length(v);
    if (lengths <= 1e-12)
        return 0;
    return Math.acos(clamp(vec3.dot(u, v) / lengths, -1, 1));
}
function writeWorldRotation(entity: Entity, world: quat.Quat): void {
    if (entity.parent) {
        quat.fromMat4Rotation(parentRotation, entity.parent.worldMatrix);
        quat.conjugate(parentRotation, parentRotation);
        quat.multiply(localRotation, parentRotation, world);
    }
    else {
        quat.copy(localRotation, world);
    }
    quat.toEulerDegrees(entity.transform.rotation, localRotation);
}
export function solveTwoBoneIk(chain: TwoBoneChain, target: Vec3, bendHint: Vec3 | null): boolean {
    mat4.getTranslation(a, chain.upper.worldMatrix);
    mat4.getTranslation(b, chain.lower.worldMatrix);
    mat4.getTranslation(c, chain.end.worldMatrix);
    vec3.subtract(ab, b, a);
    vec3.subtract(ac, c, a);
    vec3.subtract(at, target, a);
    vec3.subtract(ba, a, b);
    vec3.subtract(bc, c, b);
    const upperLength = vec3.length(ab);
    const lowerLength = vec3.length(bc);
    if (upperLength <= 1e-6 || lowerLength <= 1e-6)
        return false;
    const reach = clamp(vec3.length(at), REACH_EPSILON, upperLength + lowerLength - REACH_EPSILON);
    const currentUpperAngle = angleBetween(ac, ab);
    const currentElbowAngle = angleBetween(ba, bc);
    const aimAngle = angleBetween(ac, at);
    const nextUpperAngle = Math.acos(clamp((lowerLength * lowerLength - upperLength * upperLength - reach * reach) / (-2 * upperLength * reach), -1, 1));
    const nextElbowAngle = Math.acos(clamp((reach * reach - upperLength * upperLength - lowerLength * lowerLength) / (-2 * upperLength * lowerLength), -1, 1));
    vec3.cross(axis0, ac, ab);
    if (vec3.length(axis0) < STRAIGHT_EPSILON * Math.max(vec3.length(ac), 1e-6)) {
        const hint = bendHint ?? vec3.set(fallbackHint, 0, 0, 1);
        vec3.cross(axis0, ac, hint);
        if (vec3.length(axis0) < 1e-6) {
            vec3.cross(axis0, ac, vec3.set(fallbackHint, 1, 0, 0));
            if (vec3.length(axis0) < 1e-6)
                vec3.cross(axis0, ac, vec3.set(fallbackHint, 0, 1, 0));
        }
    }
    vec3.normalize(axis0, axis0);
    quat.fromAxisAngle(r0, axis0, nextUpperAngle - currentUpperAngle);
    quat.fromAxisAngle(r1, axis0, nextElbowAngle - currentElbowAngle);
    vec3.cross(axis1, ac, at);
    if (vec3.length(axis1) > 1e-6) {
        vec3.normalize(axis1, axis1);
        quat.fromAxisAngle(r2, axis1, aimAngle);
    }
    else {
        quat.identity(r2);
    }
    quat.fromMat4Rotation(worldUpper, chain.upper.worldMatrix);
    quat.fromMat4Rotation(worldLower, chain.lower.worldMatrix);
    quat.multiply(nextWorld, r1, worldLower);
    writeWorldRotation(chain.lower, nextWorld);
    quat.multiply(nextWorld, r0, worldUpper);
    quat.multiply(nextWorld, r2, nextWorld);
    writeWorldRotation(chain.upper, nextWorld);
    return true;
}
