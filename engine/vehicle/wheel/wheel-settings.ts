import { clamp } from '@/engine/core/math/scalar';
import { cloneWheelFrictionCurve, createWheelFrictionCurve, normalizeWheelFrictionCurve, type WheelFrictionCurve } from './wheel-friction';
export interface WheelSettings {
    radius: number;
    mass: number;
    steering: boolean;
    driven: boolean;
    handbrake: boolean;
    suspensionTravel: number;
    suspensionFrequency: number;
    suspensionDamping: number;
    forwardFriction: WheelFrictionCurve;
    sidewaysFriction: WheelFrictionCurve;
}
const WHEEL_SCALAR_RANGE = {
    radius: [0.05, 3],
    mass: [0.5, 500],
    suspensionTravel: [0.01, 2],
    suspensionFrequency: [0.5, 10],
    suspensionDamping: [0, 2],
} as const satisfies Partial<Record<keyof WheelSettings, readonly [number, number]>>;
export type WheelScalar = keyof typeof WHEEL_SCALAR_RANGE;
const WHEEL_SCALARS = Object.keys(WHEEL_SCALAR_RANGE) as WheelScalar[];
const WHEEL_ROLES = ['steering', 'driven', 'handbrake'] as const;
export type WheelRole = (typeof WHEEL_ROLES)[number];
const WHEEL_FRICTION_AXES = ['forwardFriction', 'sidewaysFriction'] as const;
export type WheelFrictionAxis = (typeof WHEEL_FRICTION_AXES)[number];
function createSidewaysFriction(): WheelFrictionCurve {
    return createWheelFrictionCurve({ extremumValue: 1.05, asymptoteSlip: 0.5 });
}
export function createWheelSettings(overrides: Partial<WheelSettings> = {}): WheelSettings {
    return {
        radius: 0.34,
        mass: 18,
        steering: false,
        driven: false,
        handbrake: false,
        suspensionTravel: 0.22,
        suspensionFrequency: 1.8,
        suspensionDamping: 0.45,
        forwardFriction: createWheelFrictionCurve(),
        sidewaysFriction: createSidewaysFriction(),
        ...overrides,
    };
}
export function cloneWheelSettings(settings: WheelSettings): WheelSettings {
    return {
        ...settings,
        forwardFriction: cloneWheelFrictionCurve(settings.forwardFriction),
        sidewaysFriction: cloneWheelFrictionCurve(settings.sidewaysFriction),
    };
}
export function clampWheelScalar(key: WheelScalar, value: number): number {
    const [min, max] = WHEEL_SCALAR_RANGE[key];
    return clamp(value, min, max);
}
export function normalizeWheelSettings(settings: WheelSettings): WheelSettings {
    const defaults = createWheelSettings();
    const normalized = cloneWheelSettings(defaults);
    for (const key of WHEEL_SCALARS) {
        if (Number.isFinite(settings[key]))
            normalized[key] = clampWheelScalar(key, settings[key]);
    }
    for (const role of WHEEL_ROLES)
        normalized[role] = settings[role] === true;
    for (const axis of WHEEL_FRICTION_AXES)
        normalized[axis] = normalizeWheelFrictionCurve(settings[axis], defaults[axis]);
    return normalized;
}
export function wheelInertia(settings: WheelSettings): number {
    return 0.5 * settings.mass * settings.radius * settings.radius;
}
