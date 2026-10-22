import * as quat from '@/engine/core/math/quat';
import { describeRigProfile, normalizeBoneName, resolveSemanticBones, type RigProfile, type SemanticBone } from '@/engine/core/animation/bone-roles';
import type { Entity } from './entity';
const MATRIX_FLOATS = 16;
export interface RigBindPose {
    readonly positions: Float32Array;
    readonly rotations: Float32Array;
    readonly scales: Float32Array;
}
export interface RigOptions {
    name: string;
    joints: readonly Entity[];
    inverseBindMatrices?: Float32Array;
    bind?: RigBindPose;
    unitScale?: number;
}
export function captureBindPose(joints: readonly Entity[]): RigBindPose {
    const positions = new Float32Array(joints.length * 3);
    const rotations = new Float32Array(joints.length * 4);
    const scales = new Float32Array(joints.length * 3);
    joints.forEach((joint, index) => {
        positions.set(joint.transform.position, index * 3);
        quat.fromEulerDegrees(rotations.subarray(index * 4, index * 4 + 4), joint.transform.rotation);
        scales.set(joint.transform.scale, index * 3);
    });
    return { positions, rotations, scales };
}
export class Rig {
    readonly name: string;
    readonly joints: readonly Entity[];
    readonly jointCount: number;
    readonly names: readonly string[];
    readonly parents: Int32Array;
    readonly inverseBindMatrices: Float32Array;
    readonly bindPositions: Float32Array;
    readonly bindRotations: Float32Array;
    readonly bindScales: Float32Array;
    readonly semantic: Readonly<Record<SemanticBone, number>>;
    readonly profile: RigProfile;
    readonly unitScale: number;
    private readonly indexByJoint = new Map<Entity, number>();
    private readonly indexByNormalizedName = new Map<string, number>();
    constructor(options: RigOptions) {
        this.name = options.name;
        this.joints = options.joints;
        this.jointCount = options.joints.length;
        this.names = options.joints.map((joint) => joint.name);
        this.unitScale = options.unitScale ?? 1;
        options.joints.forEach((joint, index) => {
            this.indexByJoint.set(joint, index);
            const key = normalizeBoneName(joint.name);
            if (!this.indexByNormalizedName.has(key))
                this.indexByNormalizedName.set(key, index);
        });
        this.parents = new Int32Array(this.jointCount);
        options.joints.forEach((joint, index) => {
            let ancestor = joint.parent;
            while (ancestor && !this.indexByJoint.has(ancestor))
                ancestor = ancestor.parent;
            this.parents[index] = ancestor ? (this.indexByJoint.get(ancestor) as number) : -1;
        });
        if (options.inverseBindMatrices && options.inverseBindMatrices.length !== this.jointCount * MATRIX_FLOATS) {
            throw new Error(`Rig ${options.name} com ${this.jointCount} juntas e ${options.inverseBindMatrices.length / MATRIX_FLOATS} matrizes de ligação.`);
        }
        this.inverseBindMatrices = options.inverseBindMatrices ?? identityMatrices(this.jointCount);
        const bind = options.bind ?? captureBindPose(options.joints);
        this.bindPositions = bind.positions;
        this.bindRotations = bind.rotations;
        this.bindScales = bind.scales;
        this.semantic = resolveSemanticBones(this.names);
        this.profile = describeRigProfile(this.names, this.semantic);
    }
    jointIndex(entity: Entity): number {
        return this.indexByJoint.get(entity) ?? -1;
    }
    jointByName(name: string): number {
        const exact = this.names.indexOf(name);
        if (exact !== -1)
            return exact;
        return this.indexByNormalizedName.get(normalizeBoneName(name)) ?? -1;
    }
    rootJoints(): number[] {
        const roots: number[] = [];
        for (let joint = 0; joint < this.jointCount; joint++)
            if (this.parents[joint] === -1)
                roots.push(joint);
        return roots;
    }
    childrenOf(joint: number): number[] {
        const children: number[] = [];
        for (let candidate = 0; candidate < this.jointCount; candidate++)
            if (this.parents[candidate] === joint)
                children.push(candidate);
        return children;
    }
    depth(joint: number): number {
        let depth = 0;
        for (let parent = this.parents[joint]; parent !== -1; parent = this.parents[parent])
            depth++;
        return depth;
    }
    roleOf(joint: number): SemanticBone | null {
        for (const [role, index] of Object.entries(this.semantic) as Array<[
            SemanticBone,
            number
        ]>)
            if (index === joint)
                return role;
        return null;
    }
    applyBindPose(): void {
        this.joints.forEach((joint, index) => {
            joint.transform.position.set(this.bindPositions.subarray(index * 3, index * 3 + 3));
            quat.toEulerDegrees(joint.transform.rotation, this.bindRotations.subarray(index * 4, index * 4 + 4));
            joint.transform.scale.set(this.bindScales.subarray(index * 3, index * 3 + 3));
        });
    }
    remap(copies: ReadonlyMap<Entity, Entity>): Rig {
        return new Rig({
            name: this.name,
            joints: this.joints.map((joint) => copies.get(joint) ?? joint),
            inverseBindMatrices: this.inverseBindMatrices,
            bind: { positions: this.bindPositions, rotations: this.bindRotations, scales: this.bindScales },
            unitScale: this.unitScale,
        });
    }
}
function identityMatrices(count: number): Float32Array {
    const matrices = new Float32Array(count * MATRIX_FLOATS);
    for (let i = 0; i < count; i++) {
        const offset = i * MATRIX_FLOATS;
        matrices[offset] = matrices[offset + 5] = matrices[offset + 10] = matrices[offset + 15] = 1;
    }
    return matrices;
}
export function findJointOwner(entity: Entity): {
    owner: Entity;
    rig: Rig;
    joint: number;
} | null {
    for (let ancestor = entity.parent; ancestor; ancestor = ancestor.parent) {
        const rig = ancestor.rig;
        if (!rig)
            continue;
        const joint = rig.jointIndex(entity);
        if (joint !== -1)
            return { owner: ancestor, rig, joint };
    }
    return null;
}
export function findRig(entity: Entity): {
    owner: Entity;
    rig: Rig;
} | null {
    for (let current: Entity | null = entity; current; current = current.parent)
        if (current.rig)
            return { owner: current, rig: current.rig };
    return null;
}
