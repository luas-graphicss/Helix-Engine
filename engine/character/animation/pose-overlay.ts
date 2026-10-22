import * as quat from '@/engine/core/math/quat';
import type { Quat } from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import { SEMANTIC_BONES, type SemanticBone, type SkeletonTemplate } from '@/engine/character/rig/skeleton';
import type { Pose } from '@/engine/character/rig/pose';
export type OverlayAngles = Partial<Record<SemanticBone, readonly [
    number,
    number,
    number
]>>;
export interface OverlayKey {
    readonly time: number;
    readonly angles: OverlayAngles;
    readonly hipsDrop?: number;
}
const chainScratch: number[] = [];
const parentWorld = quat.create();
const parentInverse = quat.create();
const offsetQuat = quat.create();
const temp = quat.create();
const angleScratch = vec3.create();
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}
function worldRotation(template: SkeletonTemplate, pose: Pose, joint: number, out: Quat): Quat {
    chainScratch.length = 0;
    for (let current = joint; current !== -1; current = template.parents[current])
        chainScratch.push(current);
    quat.identity(out);
    for (let i = chainScratch.length - 1; i >= 0; i--)
        quat.multiply(out, out, pose.rotation(chainScratch[i]));
    return out;
}
export function rotateInCharacterSpace(template: SkeletonTemplate, pose: Pose, joint: number, offset: Quat): void {
    const local = pose.rotation(joint);
    const parent = template.parents[joint];
    if (parent === -1) {
        quat.multiply(local, offset, local);
        return;
    }
    worldRotation(template, pose, parent, parentWorld);
    quat.conjugate(parentInverse, parentWorld);
    quat.multiply(temp, offset, parentWorld);
    quat.multiply(temp, parentInverse, temp);
    quat.multiply(local, temp, local);
}
export class PoseOverlay {
    private readonly keys: readonly OverlayKey[];
    constructor(readonly name: string, readonly duration: number, readonly loop: boolean, keys: readonly OverlayKey[]) {
        this.keys = [...keys].sort((a, b) => a.time - b.time);
    }
    apply(time: number, template: SkeletonTemplate, pose: Pose): void {
        const { keys } = this;
        if (keys.length === 0)
            return;
        let t = this.loop ? time % this.duration : clamp(time, 0, this.duration);
        if (t < 0)
            t += this.duration;
        let i = keys.length - 1;
        while (i > 0 && keys[i].time > t)
            i--;
        const a = keys[i];
        const b = i + 1 < keys.length ? keys[i + 1] : this.loop ? keys[0] : a;
        const end = i + 1 < keys.length ? b.time : this.loop ? this.duration : a.time;
        const span = end - a.time;
        const u = span > 0 ? smoothstep(clamp((t - a.time) / span, 0, 1)) : 0;
        for (const joint of template.order) {
            const bone = boneOf(template, joint);
            if (!bone)
                continue;
            const from = a.angles[bone];
            const to = b.angles[bone];
            if (!from && !to)
                continue;
            for (let axis = 0; axis < 3; axis++) {
                const start = from ? from[axis] : 0;
                const finish = to ? to[axis] : 0;
                angleScratch[axis] = start + (finish - start) * u;
            }
            if (angleScratch[0] === 0 && angleScratch[1] === 0 && angleScratch[2] === 0)
                continue;
            quat.fromEulerDegrees(offsetQuat, angleScratch);
            rotateInCharacterSpace(template, pose, joint, offsetQuat);
        }
        const drop = (a.hipsDrop ?? 0) + ((b.hipsDrop ?? 0) - (a.hipsDrop ?? 0)) * u;
        const hips = template.semantic.hips;
        if (drop !== 0 && hips !== -1)
            pose.position(hips)[1] -= drop / template.unitScale;
    }
}
const boneByJoint = new WeakMap<SkeletonTemplate, Array<SemanticBone | null>>();
function boneOf(template: SkeletonTemplate, joint: number): SemanticBone | null {
    let table = boneByJoint.get(template);
    if (!table) {
        table = new Array<SemanticBone | null>(template.jointCount).fill(null);
        for (const bone of SEMANTIC_BONES) {
            const index = template.semantic[bone];
            if (index !== -1)
                table[index] = bone;
        }
        boneByJoint.set(template, table);
    }
    return table[joint];
}
