import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export type PhysicsQuality = 'low' | 'medium' | 'high';
export interface PhysicsSettings {
    gravity: Vec3;
    fixedTimestep: number;
    substeps: number;
    solverIterations: number;
    relaxIterations: number;
    contactHertz: number;
    contactDampingRatio: number;
    contactPushMaxVelocity: number;
    linearSlop: number;
    speculativeDistance: number;
    restitutionThreshold: number;
    maxLinearSpeed: number;
    sleepEnabled: boolean;
    sleepLinearThreshold: number;
    sleepAngularThreshold: number;
    timeToSleep: number;
    fallLimitY: number;
    warmStarting: boolean;
    waterDensity: number;
    waterDrag: number;
    waterAngularDrag: number;
}
export const FRESH_WATER_DENSITY = 1000;
export const PHYSICS_QUALITY_PRESETS: Record<PhysicsQuality, Pick<PhysicsSettings, 'substeps' | 'solverIterations' | 'relaxIterations'>> = {
    low: { substeps: 2, solverIterations: 1, relaxIterations: 1 },
    medium: { substeps: 4, solverIterations: 1, relaxIterations: 1 },
    high: { substeps: 8, solverIterations: 2, relaxIterations: 1 },
};
export const EARTH_GRAVITY = -9.81;
export function createPhysicsSettings(overrides: Partial<PhysicsSettings> = {}): PhysicsSettings {
    const linearSlop = 0.005;
    return {
        gravity: vec3.create(0, EARTH_GRAVITY, 0),
        fixedTimestep: 1 / 60,
        ...PHYSICS_QUALITY_PRESETS.medium,
        contactHertz: 30,
        contactDampingRatio: 10,
        contactPushMaxVelocity: 3,
        linearSlop,
        speculativeDistance: 4 * linearSlop,
        restitutionThreshold: 1,
        maxLinearSpeed: 100,
        sleepEnabled: true,
        sleepLinearThreshold: 0.05,
        sleepAngularThreshold: 0.05,
        timeToSleep: 0.5,
        fallLimitY: -500,
        warmStarting: true,
        waterDensity: FRESH_WATER_DENSITY,
        waterDrag: 1,
        waterAngularDrag: 1,
        ...overrides,
    };
}
export function matchPhysicsQuality(settings: PhysicsSettings): PhysicsQuality | null {
    for (const quality of Object.keys(PHYSICS_QUALITY_PRESETS) as PhysicsQuality[]) {
        const preset = PHYSICS_QUALITY_PRESETS[quality];
        if (preset.substeps === settings.substeps &&
            preset.solverIterations === settings.solverIterations &&
            preset.relaxIterations === settings.relaxIterations) {
            return quality;
        }
    }
    return null;
}
