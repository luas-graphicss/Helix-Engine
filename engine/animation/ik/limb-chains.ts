import type { SemanticBone } from '@/engine/core/animation/bone-roles';
import type { Rig } from '@/engine/core/scene/rig';
export type LimbId = 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
export const LIMB_IDS: readonly LimbId[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
export interface LimbDefinition {
    readonly id: LimbId;
    readonly label: string;
    readonly shortLabel: string;
    readonly upper: SemanticBone;
    readonly lower: SemanticBone;
    readonly end: SemanticBone;
    readonly bend: 'forward' | 'backward';
}
export const LIMBS: Record<LimbId, LimbDefinition> = {
    leftArm: { id: 'leftArm', label: 'Braço esquerdo', shortLabel: 'Braço E', upper: 'leftArm', lower: 'leftForeArm', end: 'leftHand', bend: 'backward' },
    rightArm: { id: 'rightArm', label: 'Braço direito', shortLabel: 'Braço D', upper: 'rightArm', lower: 'rightForeArm', end: 'rightHand', bend: 'backward' },
    leftLeg: { id: 'leftLeg', label: 'Perna esquerda', shortLabel: 'Perna E', upper: 'leftUpLeg', lower: 'leftLeg', end: 'leftFoot', bend: 'forward' },
    rightLeg: { id: 'rightLeg', label: 'Perna direita', shortLabel: 'Perna D', upper: 'rightUpLeg', lower: 'rightLeg', end: 'rightFoot', bend: 'forward' },
};
export interface LimbJoints {
    readonly upper: number;
    readonly lower: number;
    readonly end: number;
}
export function resolveLimb(rig: Rig, limb: LimbId): LimbJoints | null {
    const definition = LIMBS[limb];
    const upper = rig.semantic[definition.upper];
    const lower = rig.semantic[definition.lower];
    const end = rig.semantic[definition.end];
    if (upper === -1 || lower === -1 || end === -1)
        return null;
    return { upper, lower, end };
}
export function availableLimbs(rig: Rig): LimbId[] {
    return LIMB_IDS.filter((limb) => resolveLimb(rig, limb) !== null);
}
export function limbOfEndJoint(rig: Rig, joint: number): LimbId | null {
    for (const limb of LIMB_IDS)
        if (rig.semantic[LIMBS[limb].end] === joint)
            return limb;
    return null;
}
