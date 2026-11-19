import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export interface TirePatch {
    isActive: boolean;
    isLocked: boolean;
    readonly forward: Vec3;
    readonly side: Vec3;
    readonly point: Vec3;
    forwardGrip: number;
    sideGrip: number;
    forwardCompliance: number;
    sideCompliance: number;
    brakedSpin: number;
    leftoverStride: number;
    forwardForce: number;
    sideForce: number;
}
export function createTirePatch(): TirePatch {
    return {
        isActive: false,
        isLocked: false,
        forward: vec3.create(0, 0, 1),
        side: vec3.create(1, 0, 0),
        point: vec3.create(),
        forwardGrip: 0,
        sideGrip: 0,
        forwardCompliance: 0,
        sideCompliance: 0,
        brakedSpin: 0,
        leftoverStride: 0,
        forwardForce: 0,
        sideForce: 0,
    };
}
