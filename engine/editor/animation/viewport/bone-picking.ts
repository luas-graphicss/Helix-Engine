import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { createRay } from '@/engine/core/math/ray';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { LIMB_IDS, resolveLimb, type LimbId } from '@/engine/animation/ik/limb-chains';
import { createScreenPoint, distanceToSegment2D, projectToScreen } from '@/engine/editor/gizmo/screen-space';
import { buildPickRay } from '@/engine/editor/viewport/pick-entity';
import type { AnimationEditor, Performer } from '../animation-editor';
export interface BoneHit {
    readonly performer: Performer;
    readonly joint: number;
    readonly name: string;
}
export interface EffectorHit {
    readonly performer: Performer;
    readonly limb: LimbId;
}
const JOINT_PICK_RADIUS = 9;
const BONE_PICK_RADIUS = 6;
const EFFECTOR_PICK_RADIUS = 16;
const parentScreen = createScreenPoint();
const childScreen = createScreenPoint();
const parentWorld = vec3.create();
const childWorld = vec3.create();
const ray = createRay();
const planeDelta = vec3.create();
interface Viewport {
    x: number;
    y: number;
    width: number;
    height: number;
}
export function pickBone(editor: AnimationEditor, camera: PerspectiveCamera, pointer: Viewport): BoneHit | null {
    let best: BoneHit | null = null;
    let bestDistance = Infinity;
    let bestDepth = Infinity;
    const viewProjection = camera.viewProjectionMatrix;
    for (const performer of editor.performers) {
        const { rig } = performer;
        rig.joints.forEach((joint, index) => {
            if (!joint)
                return;
            mat4.getTranslation(childWorld, joint.worldMatrix);
            if (!projectToScreen(childScreen, viewProjection, childWorld, pointer.width, pointer.height))
                return;
            const depth = vec3.distance(childWorld, camera.position);
            const jointDistance = Math.hypot(pointer.x - childScreen[0], pointer.y - childScreen[1]);
            let distance = jointDistance <= JOINT_PICK_RADIUS ? jointDistance - JOINT_PICK_RADIUS : Infinity;
            const parent = rig.parents[index];
            const parentJoint = parent === -1 ? null : rig.joints[parent];
            if (parentJoint && distance === Infinity) {
                mat4.getTranslation(parentWorld, parentJoint.worldMatrix);
                if (projectToScreen(parentScreen, viewProjection, parentWorld, pointer.width, pointer.height)) {
                    const boneDistance = distanceToSegment2D(pointer.x, pointer.y, parentScreen[0], parentScreen[1], childScreen[0], childScreen[1]);
                    if (boneDistance <= BONE_PICK_RADIUS)
                        distance = boneDistance;
                }
            }
            if (distance === Infinity)
                return;
            if (distance < bestDistance - 0.5 || (Math.abs(distance - bestDistance) <= 0.5 && depth < bestDepth)) {
                best = { performer, joint: index, name: rig.names[index] };
                bestDistance = distance;
                bestDepth = depth;
            }
        });
    }
    return best;
}
export function pickEffector(editor: AnimationEditor, camera: PerspectiveCamera, pointer: Viewport): EffectorHit | null {
    let best: EffectorHit | null = null;
    let bestDistance = EFFECTOR_PICK_RADIUS;
    for (const performer of editor.performers) {
        if (performer.source.kind !== 'clip')
            continue;
        for (const limb of LIMB_IDS) {
            if (!editor.ik[limb])
                continue;
            const joints = resolveLimb(performer.rig, limb);
            const end = joints ? performer.rig.joints[joints.end] : null;
            if (!end)
                continue;
            mat4.getTranslation(childWorld, end.worldMatrix);
            if (!projectToScreen(childScreen, camera.viewProjectionMatrix, childWorld, pointer.width, pointer.height))
                continue;
            const distance = Math.hypot(pointer.x - childScreen[0], pointer.y - childScreen[1]);
            if (distance < bestDistance) {
                best = { performer, limb };
                bestDistance = distance;
            }
        }
    }
    return best;
}
export function dragPointOnViewPlane(out: Vec3, camera: PerspectiveCamera, anchor: Vec3, pointer: Viewport): boolean {
    if (!buildPickRay(ray, camera, pointer.x / pointer.width, pointer.y / pointer.height))
        return false;
    vec3.subtract(planeDelta, camera.target, camera.position);
    vec3.normalize(planeDelta, planeDelta);
    const denominator = vec3.dot(ray.direction, planeDelta);
    if (Math.abs(denominator) < 1e-6)
        return false;
    const t = (vec3.dot(anchor, planeDelta) - vec3.dot(ray.origin, planeDelta)) / denominator;
    if (t <= 0)
        return false;
    vec3.scaleAndAdd(out, ray.origin, ray.direction, t);
    return true;
}
