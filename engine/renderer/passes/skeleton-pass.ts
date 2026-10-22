import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { GL } from '@/engine/renderer/gl/context';
import { GpuMesh } from '@/engine/renderer/gl/gpu-mesh';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { GIZMO_FRAGMENT_SHADER, GIZMO_VERTEX_SHADER } from '@/engine/renderer/shaders/gizmo.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createSkeletonGeometry } from '@/engine/renderer/geometry/skeleton-geometry';
export interface SkeletonOverlayRig {
    readonly joints: ReadonlyArray<Entity | null>;
    readonly parents: Int32Array;
    readonly sides: Int8Array;
    readonly selected: Set<number>;
    hovered: number;
    effectors: ReadonlyArray<{
        joint: number;
        active: boolean;
    }>;
}
export interface SkeletonOverlayRequest {
    readonly rigs: readonly SkeletonOverlayRig[];
    readonly xray: boolean;
}
type Rgb = readonly [
    number,
    number,
    number
];
const SIDE_COLOR: Record<-1 | 0 | 1, Rgb> = {
    [-1]: [0.36, 0.6, 0.98],
    0: [0.78, 0.8, 0.84],
    1: [0.96, 0.42, 0.38],
};
const SELECTED_COLOR: Rgb = [1, 0.84, 0.25];
const HOVERED_COLOR: Rgb = [1, 1, 1];
const EFFECTOR_COLOR: Rgb = [0.3, 0.86, 0.9];
const BONE_ALPHA = 0.78;
const JOINT_ALPHA = 0.95;
const BONE_RADIUS_FACTOR = 0.09;
const JOINT_RADIUS_FACTOR = 0.08;
const EFFECTOR_RADIUS_FACTOR = 0.42;
const MIN_RADIUS = 0.004;
const parentPosition = vec3.create();
const childPosition = vec3.create();
const direction = vec3.create();
const sideAxis = vec3.create();
const upAxis = vec3.create();
const reference = vec3.create();
const model = mat4.create();
function colorOf(rig: SkeletonOverlayRig, joint: number): Rgb {
    if (rig.selected.has(joint))
        return SELECTED_COLOR;
    if (rig.hovered === joint)
        return HOVERED_COLOR;
    return SIDE_COLOR[rig.sides[joint] as -1 | 0 | 1];
}
function averageBoneLength(rig: SkeletonOverlayRig): number {
    let total = 0;
    let count = 0;
    rig.joints.forEach((joint, index) => {
        const parent = rig.parents[index];
        const parentJoint = parent === -1 ? null : rig.joints[parent];
        if (!joint || !parentJoint)
            return;
        mat4.getTranslation(childPosition, joint.worldMatrix);
        mat4.getTranslation(parentPosition, parentJoint.worldMatrix);
        const length = vec3.distance(childPosition, parentPosition);
        if (length > 1e-5) {
            total += length;
            count++;
        }
    });
    return count > 0 ? total / count : 0.1;
}
function boneMatrix(out: Float32Array, from: Float32Array, to: Float32Array, radius: number): number {
    vec3.subtract(direction, to, from);
    const length = vec3.length(direction);
    if (length <= 1e-6)
        return 0;
    vec3.scale(upAxis, direction, 1 / length);
    vec3.set(reference, Math.abs(upAxis[1]) < 0.9 ? 0 : 1, Math.abs(upAxis[1]) < 0.9 ? 1 : 0, 0);
    vec3.cross(sideAxis, upAxis, reference);
    vec3.normalize(sideAxis, sideAxis);
    vec3.cross(reference, sideAxis, upAxis);
    out[0] = sideAxis[0] * radius;
    out[1] = sideAxis[1] * radius;
    out[2] = sideAxis[2] * radius;
    out[3] = 0;
    out[4] = direction[0];
    out[5] = direction[1];
    out[6] = direction[2];
    out[7] = 0;
    out[8] = reference[0] * radius;
    out[9] = reference[1] * radius;
    out[10] = reference[2] * radius;
    out[11] = 0;
    out[12] = from[0];
    out[13] = from[1];
    out[14] = from[2];
    out[15] = 1;
    return length;
}
function uniformMatrix(out: Float32Array, position: Float32Array, scale: number): void {
    mat4.identity(out);
    out[0] = out[5] = out[10] = scale;
    out[12] = position[0];
    out[13] = position[1];
    out[14] = position[2];
}
export class SkeletonPass {
    private readonly program: ShaderProgram;
    private readonly bone: GpuMesh;
    private readonly joint: GpuMesh;
    private readonly ring: GpuMesh;
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, GIZMO_VERTEX_SHADER, GIZMO_FRAGMENT_SHADER);
        const geometry = createSkeletonGeometry();
        this.bone = new GpuMesh(gl, geometry.bone);
        this.joint = new GpuMesh(gl, geometry.joint);
        this.ring = new GpuMesh(gl, geometry.ring);
    }
    render(request: SkeletonOverlayRequest, camera: PerspectiveCamera): number {
        const { gl, program } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), camera.position);
        gl.uniform3f(program.uniform('u_origin'), 0, 0, 0);
        gl.uniform1f(program.uniform('u_dimBack'), 0);
        const modelLocation = program.uniform('u_model');
        const colorLocation = program.uniform('u_color');
        const alphaLocation = program.uniform('u_alpha');
        if (request.xray)
            gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        let drawCalls = 0;
        const draw = (mesh: GpuMesh, color: Rgb, alpha: number) => {
            gl.uniformMatrix4fv(modelLocation, false, model);
            gl.uniform3f(colorLocation, color[0], color[1], color[2]);
            gl.uniform1f(alphaLocation, alpha);
            mesh.draw();
            drawCalls++;
        };
        for (const rig of request.rigs) {
            const unit = averageBoneLength(rig);
            const boneRadius = Math.max(unit * BONE_RADIUS_FACTOR, MIN_RADIUS);
            const jointRadius = Math.max(unit * JOINT_RADIUS_FACTOR, MIN_RADIUS);
            rig.joints.forEach((joint, index) => {
                if (!joint)
                    return;
                mat4.getTranslation(childPosition, joint.worldMatrix);
                const parent = rig.parents[index];
                const parentJoint = parent === -1 ? null : rig.joints[parent];
                if (parentJoint) {
                    mat4.getTranslation(parentPosition, parentJoint.worldMatrix);
                    const length = boneMatrix(model, parentPosition, childPosition, Math.min(boneRadius, Math.max(vec3.distance(parentPosition, childPosition) * 0.25, MIN_RADIUS)));
                    if (length > 0)
                        draw(this.bone, colorOf(rig, index), rig.selected.has(index) || rig.hovered === index ? 1 : BONE_ALPHA);
                }
                const emphasized = rig.selected.has(index) || rig.hovered === index;
                uniformMatrix(model, childPosition, emphasized ? jointRadius * 1.35 : jointRadius);
                draw(this.joint, colorOf(rig, index), JOINT_ALPHA);
            });
            for (const effector of rig.effectors) {
                const joint = rig.joints[effector.joint];
                if (!joint)
                    continue;
                mat4.getTranslation(childPosition, joint.worldMatrix);
                uniformMatrix(model, childPosition, Math.max(unit * EFFECTOR_RADIUS_FACTOR, MIN_RADIUS * 4));
                draw(this.ring, effector.active ? SELECTED_COLOR : EFFECTOR_COLOR, effector.active ? 1 : 0.85);
            }
        }
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        return drawCalls;
    }
    dispose(): void {
        this.bone.dispose();
        this.joint.dispose();
        this.ring.dispose();
        this.program.dispose();
    }
}
