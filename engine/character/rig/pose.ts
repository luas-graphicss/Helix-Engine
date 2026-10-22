import * as quat from '@/engine/core/math/quat';
import type { Quat } from '@/engine/core/math/quat';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
export class Pose {
    readonly positions: Float32Array;
    readonly rotations: Float32Array;
    readonly scales: Float32Array;
    private readonly positionViews: Vec3[] = [];
    private readonly rotationViews: Quat[] = [];
    private readonly scaleViews: Vec3[] = [];
    constructor(readonly jointCount: number) {
        this.positions = new Float32Array(jointCount * 3);
        this.rotations = new Float32Array(jointCount * 4);
        this.scales = new Float32Array(jointCount * 3);
        for (let i = 0; i < jointCount; i++) {
            this.positionViews.push(this.positions.subarray(i * 3, i * 3 + 3));
            this.rotationViews.push(this.rotations.subarray(i * 4, i * 4 + 4));
            this.scaleViews.push(this.scales.subarray(i * 3, i * 3 + 3));
            this.rotations[i * 4 + 3] = 1;
            this.scales[i * 3] = this.scales[i * 3 + 1] = this.scales[i * 3 + 2] = 1;
        }
    }
    position(joint: number): Vec3 {
        return this.positionViews[joint];
    }
    rotation(joint: number): Quat {
        return this.rotationViews[joint];
    }
    scale(joint: number): Vec3 {
        return this.scaleViews[joint];
    }
    copy(source: Pose): this {
        this.positions.set(source.positions);
        this.rotations.set(source.rotations);
        this.scales.set(source.scales);
        return this;
    }
}
export function blendPoses(out: Pose, a: Pose, b: Pose, t: number): void {
    if (t <= 0) {
        if (out !== a)
            out.copy(a);
        return;
    }
    if (t >= 1) {
        if (out !== b)
            out.copy(b);
        return;
    }
    const { positions, scales } = out;
    for (let i = 0; i < positions.length; i++) {
        positions[i] = a.positions[i] + (b.positions[i] - a.positions[i]) * t;
        scales[i] = a.scales[i] + (b.scales[i] - a.scales[i]) * t;
    }
    for (let i = 0; i < out.jointCount; i++)
        quat.nlerp(out.rotation(i), a.rotation(i), b.rotation(i), t);
}
export function applyPose(joints: ReadonlyArray<Entity | null>, pose: Pose): void {
    for (let i = 0; i < joints.length; i++) {
        const joint = joints[i];
        if (!joint)
            continue;
        const { transform } = joint;
        transform.position.set(pose.position(i));
        quat.toEulerDegrees(transform.rotation, pose.rotation(i));
        transform.scale.set(pose.scale(i));
    }
}
