import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
export const MAX_MANIFOLD_POINTS = 4;
export interface ContactCandidate {
    readonly position: Vec3;
    separation: number;
    id: number;
}
export class ContactResult {
    readonly normal = vec3.create();
    readonly points: ContactCandidate[] = [];
    count = 0;
    constructor() {
        for (let i = 0; i < MAX_MANIFOLD_POINTS; i++)
            this.points.push({ position: vec3.create(), separation: 0, id: 0 });
    }
    reset(): void {
        this.count = 0;
    }
    add(x: number, y: number, z: number, separation: number, id: number): void {
        if (this.count >= MAX_MANIFOLD_POINTS)
            return;
        const point = this.points[this.count++];
        vec3.set(point.position, x, y, z);
        point.separation = separation;
        point.id = id;
    }
}
export class ManifoldPoint {
    id = 0;
    readonly anchorA = vec3.create();
    readonly anchorB = vec3.create();
    separation = 0;
    adjustedSeparation = 0;
    normalMass = 0;
    tangentMass1 = 0;
    tangentMass2 = 0;
    normalImpulse = 0;
    tangentImpulse1 = 0;
    tangentImpulse2 = 0;
    maxNormalImpulse = 0;
    relativeVelocity = 0;
}
export class Manifold {
    readonly normal = vec3.create();
    readonly tangent1 = vec3.create();
    readonly tangent2 = vec3.create();
    readonly points: ManifoldPoint[] = [];
    pointCount = 0;
    stamp = 0;
    friction = 0;
    restitution = 0;
    invMassA = 0;
    invMassB = 0;
    readonly invInertiaA = mat3.create();
    readonly invInertiaB = mat3.create();
    biasRate = 0;
    massScale = 1;
    impulseScale = 0;
    constructor(readonly bodyA: RigidBody, readonly bodyB: RigidBody) {
        for (let i = 0; i < MAX_MANIFOLD_POINTS; i++)
            this.points.push(new ManifoldPoint());
    }
    update(result: ContactResult): void {
        const previousCount = this.pointCount;
        for (let i = 0; i < previousCount; i++) {
            const point = this.points[i];
            previousIds[i] = point.id;
            previousNormal[i] = point.normalImpulse;
            previousTangent1[i] = point.tangentImpulse1;
            previousTangent2[i] = point.tangentImpulse2;
        }
        vec3.copy(this.normal, result.normal);
        this.pointCount = result.count;
        for (let i = 0; i < result.count; i++) {
            const candidate = result.points[i];
            const point = this.points[i];
            point.id = candidate.id;
            point.separation = candidate.separation;
            vec3.subtract(point.anchorA, candidate.position, this.bodyA.position);
            vec3.subtract(point.anchorB, candidate.position, this.bodyB.position);
            point.normalImpulse = 0;
            point.tangentImpulse1 = 0;
            point.tangentImpulse2 = 0;
            point.maxNormalImpulse = 0;
            for (let j = 0; j < previousCount; j++) {
                if (previousIds[j] !== candidate.id)
                    continue;
                point.normalImpulse = previousNormal[j];
                point.tangentImpulse1 = previousTangent1[j];
                point.tangentImpulse2 = previousTangent2[j];
                break;
            }
        }
    }
}
const previousIds = new Int32Array(MAX_MANIFOLD_POINTS);
const previousNormal = new Float32Array(MAX_MANIFOLD_POINTS);
const previousTangent1 = new Float32Array(MAX_MANIFOLD_POINTS);
const previousTangent2 = new Float32Array(MAX_MANIFOLD_POINTS);
export function pairKey(a: RigidBody, b: RigidBody): number {
    return a.id < b.id ? a.id * 2097152 + b.id : b.id * 2097152 + a.id;
}
