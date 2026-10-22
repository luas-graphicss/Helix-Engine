import { PoseOverlay, type OverlayAngles } from '../pose-overlay';
type Angles = readonly [
    number,
    number,
    number
];
function mirrored(left: Angles): Angles {
    return [left[0], -left[1], -left[2]];
}
interface LimbAngles {
    upLeg?: Angles;
    leg?: Angles;
    foot?: Angles;
    arm?: Angles;
    foreArm?: Angles;
}
function limbs(left: LimbAngles, trunk: OverlayAngles = {}): OverlayAngles {
    const out: OverlayAngles = { ...trunk };
    if (left.upLeg) {
        out.leftUpLeg = left.upLeg;
        out.rightUpLeg = mirrored(left.upLeg);
    }
    if (left.leg) {
        out.leftLeg = left.leg;
        out.rightLeg = mirrored(left.leg);
    }
    if (left.foot) {
        out.leftFoot = left.foot;
        out.rightFoot = mirrored(left.foot);
    }
    if (left.arm) {
        out.leftArm = left.arm;
        out.rightArm = mirrored(left.arm);
    }
    if (left.foreArm) {
        out.leftForeArm = left.foreArm;
        out.rightForeArm = mirrored(left.foreArm);
    }
    return out;
}
export const JUMP_OVERLAY = new PoseOverlay('pulo', 0.4, false, [
    { time: 0, hipsDrop: 0.08, angles: limbs({ upLeg: [-25, 0, 0], leg: [45, 0, 0], arm: [28, 0, 6], foreArm: [-12, 0, 0] }, { spine: [10, 0, 0], spine1: [5, 0, 0] }) },
    { time: 0.16, hipsDrop: 0, angles: limbs({ upLeg: [6, 0, 0], leg: [6, 0, 0], foot: [22, 0, 0], arm: [-55, 0, 12], foreArm: [-30, 0, 0] }, { spine: [-3, 0, 0], head: [-5, 0, 0] }) },
    {
        time: 0.4,
        hipsDrop: 0,
        angles: {
            ...limbs({ upLeg: [-38, 0, 5], leg: [70, 0, 0], foot: [18, 0, 0], arm: [-22, 0, 24], foreArm: [-48, 0, 0] }, { spine: [8, 0, 0], spine1: [4, 0, 0] }),
            rightUpLeg: [-18, 0, -5],
            rightLeg: [52, 0, 0],
        },
    },
]);
export const FALL_OVERLAY = new PoseOverlay('queda', 1.1, true, [
    {
        time: 0,
        angles: {
            ...limbs({ upLeg: [-24, 0, 6], leg: [42, 0, 0], foot: [14, 0, 0], arm: [8, 0, 26], foreArm: [-42, 0, 0] }, { spine: [6, 0, 0], spine1: [3, 0, 0], head: [-6, 0, 0] }),
            rightUpLeg: [-6, 0, -6],
            rightLeg: [30, 0, 0],
        },
    },
    {
        time: 0.55,
        angles: {
            ...limbs({ upLeg: [-30, 0, 8], leg: [52, 0, 0], foot: [18, 0, 0], arm: [4, 0, 32], foreArm: [-50, 0, 0] }, { spine: [9, 0, 0], spine1: [4, 0, 0], head: [-9, 0, 0] }),
            rightUpLeg: [-10, 0, -8],
            rightLeg: [38, 0, 0],
        },
    },
]);
export const LAND_OVERLAY = new PoseOverlay('aterrissagem', 0.34, false, [
    { time: 0, hipsDrop: 0.2, angles: limbs({ upLeg: [-40, 0, 4], leg: [75, 0, 0], arm: [-32, 0, 22], foreArm: [-24, 0, 0] }, { spine: [20, 0, 0], spine1: [8, 0, 0], head: [10, 0, 0] }) },
    { time: 0.14, hipsDrop: 0.11, angles: limbs({ upLeg: [-30, 0, 3], leg: [55, 0, 0], arm: [-18, 0, 14], foreArm: [-14, 0, 0] }, { spine: [14, 0, 0], spine1: [5, 0, 0], head: [6, 0, 0] }) },
    { time: 0.34, hipsDrop: 0, angles: {} },
]);
