export const SEMANTIC_BONES = [
    'hips',
    'spine',
    'spine1',
    'spine2',
    'neck',
    'head',
    'leftShoulder',
    'leftArm',
    'leftForeArm',
    'leftHand',
    'rightShoulder',
    'rightArm',
    'rightForeArm',
    'rightHand',
    'leftUpLeg',
    'leftLeg',
    'leftFoot',
    'leftToe',
    'rightUpLeg',
    'rightLeg',
    'rightFoot',
    'rightToe',
] as const;
export type SemanticBone = (typeof SEMANTIC_BONES)[number];
export const SEMANTIC_BONE_LABELS: Record<SemanticBone, string> = {
    hips: 'Quadril',
    spine: 'Coluna',
    spine1: 'Coluna 2',
    spine2: 'Tórax',
    neck: 'Pescoço',
    head: 'Cabeça',
    leftShoulder: 'Ombro esq.',
    leftArm: 'Braço esq.',
    leftForeArm: 'Antebraço esq.',
    leftHand: 'Mão esq.',
    rightShoulder: 'Ombro dir.',
    rightArm: 'Braço dir.',
    rightForeArm: 'Antebraço dir.',
    rightHand: 'Mão dir.',
    leftUpLeg: 'Coxa esq.',
    leftLeg: 'Perna esq.',
    leftFoot: 'Pé esq.',
    leftToe: 'Dedos esq.',
    rightUpLeg: 'Coxa dir.',
    rightLeg: 'Perna dir.',
    rightFoot: 'Pé dir.',
    rightToe: 'Dedos dir.',
};
const HUMANOID_REQUIRED: readonly SemanticBone[] = ['hips', 'spine', 'head', 'leftArm', 'rightArm', 'leftUpLeg', 'rightUpLeg', 'leftLeg', 'rightLeg'];
const ROLE_ALIASES: Record<SemanticBone, readonly string[]> = {
    hips: ['hips', 'pelvis', 'hip', 'bip01pelvis', 'bip001pelvis', 'jbhips', 'hipsjnt'],
    spine: ['spine', 'spine01', 'spine1jnt', 'abdomenlower', 'abdomen', 'bip01spine', 'bip001spine', 'jbspine'],
    spine1: ['spine1', 'spine02', 'spine001', 'chest', 'abdomenupper', 'abdomen2', 'bip01spine1', 'bip001spine1', 'jbchest'],
    spine2: ['spine2', 'spine03', 'spine002', 'upperchest', 'chestupper', 'chestlower', 'bip01spine2', 'bip001spine2', 'jbupperchest'],
    neck: ['neck', 'neck01', 'neck1', 'necklower', 'bip01neck', 'bip001neck', 'jbneck'],
    head: ['head', 'bip01head', 'bip001head', 'jbhead'],
    leftShoulder: ['leftshoulder', 'claviclel', 'lclavicle', 'leftclavicle', 'lcollar', 'shoulderl', 'lshoulder', 'shoulderleft', 'bip01lclavicle', 'bip001lclavicle', 'jbleftshoulder'],
    leftArm: ['leftarm', 'upperarml', 'lupperarm', 'leftupperarm', 'lshldrbend', 'lshldr', 'arml', 'larm', 'armleft', 'bip01lupperarm', 'bip001lupperarm', 'jbleftupperarm'],
    leftForeArm: ['leftforearm', 'lowerarml', 'llowerarm', 'leftlowerarm', 'lforearmbend', 'lforearm', 'forearml', 'forearmleft', 'bip01lforearm', 'bip001lforearm', 'jbleftlowerarm'],
    leftHand: ['lefthand', 'handl', 'lhand', 'handleft', 'bip01lhand', 'bip001lhand', 'jblefthand'],
    rightShoulder: ['rightshoulder', 'clavicler', 'rclavicle', 'rightclavicle', 'rcollar', 'shoulderr', 'rshoulder', 'shoulderright', 'bip01rclavicle', 'bip001rclavicle', 'jbrightshoulder'],
    rightArm: ['rightarm', 'upperarmr', 'rupperarm', 'rightupperarm', 'rshldrbend', 'rshldr', 'armr', 'rarm', 'armright', 'bip01rupperarm', 'bip001rupperarm', 'jbrightupperarm'],
    rightForeArm: ['rightforearm', 'lowerarmr', 'rlowerarm', 'rightlowerarm', 'rforearmbend', 'rforearm', 'forearmr', 'forearmright', 'bip01rforearm', 'bip001rforearm', 'jbrightlowerarm'],
    rightHand: ['righthand', 'handr', 'rhand', 'handright', 'bip01rhand', 'bip001rhand', 'jbrighthand'],
    leftUpLeg: ['leftupleg', 'thighl', 'lthigh', 'leftthigh', 'leftupperleg', 'lthighbend', 'uplegl', 'lupleg', 'legupperl', 'bip01lthigh', 'bip001lthigh', 'jbleftupperleg'],
    leftLeg: ['leftleg', 'calfl', 'lcalf', 'leftcalf', 'leftlowerleg', 'lshin', 'shinl', 'shinleft', 'legl', 'lleg', 'leglowerl', 'bip01lcalf', 'bip001lcalf', 'jbleftlowerleg'],
    leftFoot: ['leftfoot', 'footl', 'lfoot', 'footleft', 'bip01lfoot', 'bip001lfoot', 'jbleftfoot'],
    leftToe: ['lefttoebase', 'lefttoes', 'lefttoe', 'balll', 'lball', 'ltoe', 'toel', 'toesl', 'ltoes', 'toeleft', 'bip01ltoe0', 'bip001ltoe0', 'jblefttoes'],
    rightUpLeg: ['rightupleg', 'thighr', 'rthigh', 'rightthigh', 'rightupperleg', 'rthighbend', 'uplegr', 'rupleg', 'legupperr', 'bip01rthigh', 'bip001rthigh', 'jbrightupperleg'],
    rightLeg: ['rightleg', 'calfr', 'rcalf', 'rightcalf', 'rightlowerleg', 'rshin', 'shinr', 'shinright', 'legr', 'rleg', 'leglowerr', 'bip01rcalf', 'bip001rcalf', 'jbrightlowerleg'],
    rightFoot: ['rightfoot', 'footr', 'rfoot', 'footright', 'bip01rfoot', 'bip001rfoot', 'jbrightfoot'],
    rightToe: ['righttoebase', 'righttoes', 'righttoe', 'ballr', 'rball', 'rtoe', 'toer', 'toesr', 'rtoes', 'toeright', 'bip01rtoe0', 'bip001rtoe0', 'jbrighttoes'],
};
export function stripBonePrefix(name: string): string {
    const colon = name.lastIndexOf(':');
    const bare = colon === -1 ? name : name.slice(colon + 1);
    return bare.replace(/^mixamorig\d*/i, '');
}
export function normalizeBoneName(name: string): string {
    return stripBonePrefix(name)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
export function resolveSemanticBones(names: readonly string[]): Record<SemanticBone, number> {
    const normalized = names.map(normalizeBoneName);
    const taken = new Set<number>();
    const semantic = {} as Record<SemanticBone, number>;
    for (const bone of SEMANTIC_BONES) {
        let found = -1;
        for (const alias of ROLE_ALIASES[bone]) {
            const index = normalized.findIndex((name, position) => name === alias && !taken.has(position));
            if (index !== -1) {
                found = index;
                break;
            }
        }
        if (found !== -1)
            taken.add(found);
        semantic[bone] = found;
    }
    return semantic;
}
export interface RigProfile {
    readonly matched: number;
    readonly total: number;
    readonly humanoid: boolean;
    readonly convention: string;
}
const CONVENTION_HINTS: ReadonlyArray<{
    label: string;
    test: (names: readonly string[]) => boolean;
}> = [
    { label: 'Mixamo', test: (names) => names.some((name) => /mixamorig/i.test(name)) || names.some((name) => stripBonePrefix(name) === 'LeftToeBase') },
    { label: 'Unreal', test: (names) => names.some((name) => /^(pelvis|spine_01|clavicle_l|thigh_l)$/i.test(name)) },
    { label: 'Rigify', test: (names) => names.some((name) => /\.(L|R)$/.test(name)) && names.some((name) => /^spine(\.\d{3})?$/i.test(name)) },
    { label: 'Biped', test: (names) => names.some((name) => /^bip0?0?1/i.test(name)) },
    { label: 'Daz', test: (names) => names.some((name) => /^(lCollar|rCollar|abdomenLower|lShldrBend)$/.test(name)) },
    { label: 'Unity Humanoid', test: (names) => names.some((name) => /^(LeftUpperArm|UpperChest|LeftToes)$/i.test(name)) },
];
export type BoneSide = -1 | 0 | 1;
export function boneSide(name: string): BoneSide {
    const bare = stripBonePrefix(name);
    const sided = bare.match(/(?:^|[\s._-])([lr])(?:$|[\s._-])/i);
    if (sided)
        return sided[1].toLowerCase() === 'l' ? -1 : 1;
    if (/^left/i.test(bare) || /left$/i.test(bare))
        return -1;
    if (/^right/i.test(bare) || /right$/i.test(bare))
        return 1;
    if (/^l[A-Z]/.test(bare) || /[a-z0-9]L$/.test(bare))
        return -1;
    if (/^r[A-Z]/.test(bare) || /[a-z0-9]R$/.test(bare))
        return 1;
    return 0;
}
export function describeRigProfile(names: readonly string[], semantic: Readonly<Record<SemanticBone, number>>): RigProfile {
    const matched = SEMANTIC_BONES.filter((bone) => semantic[bone] !== -1).length;
    const humanoid = HUMANOID_REQUIRED.every((bone) => semantic[bone] !== -1);
    const convention = CONVENTION_HINTS.find((hint) => hint.test(names))?.label ?? (humanoid ? 'Humanoide' : 'Personalizado');
    return { matched, total: SEMANTIC_BONES.length, humanoid, convention };
}
