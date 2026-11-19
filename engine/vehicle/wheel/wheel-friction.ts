import { clamp } from '@/engine/core/math/scalar';
export interface WheelFrictionCurve {
    extremumSlip: number;
    extremumValue: number;
    asymptoteSlip: number;
    asymptoteValue: number;
    stiffness: number;
}
const FRICTION_RANGE = {
    extremumSlip: [0.01, 2],
    extremumValue: [0, 4],
    asymptoteSlip: [0.02, 4],
    asymptoteValue: [0, 4],
    stiffness: [0, 4],
} as const satisfies Record<keyof WheelFrictionCurve, readonly [number, number]>;
export type WheelFrictionField = keyof WheelFrictionCurve;
const FRICTION_FIELDS = Object.keys(FRICTION_RANGE) as WheelFrictionField[];
const MIN_SLIP_SPAN = 0.01;
export function createWheelFrictionCurve(overrides: Partial<WheelFrictionCurve> = {}): WheelFrictionCurve {
    return {
        extremumSlip: 0.15,
        extremumValue: 1.1,
        asymptoteSlip: 0.6,
        asymptoteValue: 0.8,
        stiffness: 1,
        ...overrides,
    };
}
export function cloneWheelFrictionCurve(curve: WheelFrictionCurve): WheelFrictionCurve {
    return { ...curve };
}
export function clampWheelFrictionField(field: WheelFrictionField, value: number): number {
    const [min, max] = FRICTION_RANGE[field];
    return clamp(value, min, max);
}
export function normalizeWheelFrictionCurve(curve: Partial<WheelFrictionCurve> | undefined, defaults: WheelFrictionCurve): WheelFrictionCurve {
    const normalized = cloneWheelFrictionCurve(defaults);
    for (const field of FRICTION_FIELDS) {
        const value = curve?.[field];
        if (value !== undefined && Number.isFinite(value))
            normalized[field] = clampWheelFrictionField(field, value);
    }
    normalized.asymptoteSlip = Math.max(normalized.asymptoteSlip, normalized.extremumSlip + MIN_SLIP_SPAN);
    return normalized;
}
export function evaluateWheelFriction(curve: WheelFrictionCurve, slip: number): number {
    const magnitude = Math.abs(slip);
    if (magnitude <= curve.extremumSlip)
        return curve.extremumValue * curve.stiffness;
    if (magnitude >= curve.asymptoteSlip)
        return curve.asymptoteValue * curve.stiffness;
    const progress = (magnitude - curve.extremumSlip) / (curve.asymptoteSlip - curve.extremumSlip);
    const eased = progress * progress * (3 - 2 * progress);
    return (curve.extremumValue + (curve.asymptoteValue - curve.extremumValue) * eased) * curve.stiffness;
}
