import { clamp } from '@/engine/core/math/scalar';
export const VEHICLE_CONTROLS = ['player', 'script'] as const;
export type VehicleControl = (typeof VEHICLE_CONTROLS)[number];
export interface VehicleSettings {
    control: VehicleControl;
    maxTorque: number;
    idleRpm: number;
    peakRpm: number;
    maxRpm: number;
    engineBraking: number;
    gearCount: number;
    firstGearRatio: number;
    topGearRatio: number;
    reverseGearRatio: number;
    finalDriveRatio: number;
    maxSteerAngle: number;
    steerSpeed: number;
    highSpeedSteering: number;
    ackermann: number;
    brakeTorque: number;
    handbrakeTorque: number;
    bodyRoll: number;
    airDrag: number;
}
const VEHICLE_SCALAR_RANGE = {
    maxTorque: [1, 20000],
    idleRpm: [300, 3000],
    peakRpm: [500, 15000],
    maxRpm: [1000, 20000],
    engineBraking: [0, 2000],
    gearCount: [1, 10],
    firstGearRatio: [0.5, 10],
    topGearRatio: [0.2, 10],
    reverseGearRatio: [0.5, 10],
    finalDriveRatio: [0.5, 15],
    maxSteerAngle: [0, 60],
    steerSpeed: [10, 720],
    highSpeedSteering: [0.05, 1],
    ackermann: [0, 1],
    brakeTorque: [0, 50000],
    handbrakeTorque: [0, 50000],
    bodyRoll: [0, 1],
    airDrag: [0, 10],
} as const satisfies Partial<Record<keyof VehicleSettings, readonly [number, number]>>;
export type VehicleScalar = keyof typeof VEHICLE_SCALAR_RANGE;
const VEHICLE_SCALARS = Object.keys(VEHICLE_SCALAR_RANGE) as VehicleScalar[];
const MIN_REV_BAND = 200;
export function createVehicleSettings(overrides: Partial<VehicleSettings> = {}): VehicleSettings {
    return {
        control: 'player',
        maxTorque: 320,
        idleRpm: 900,
        peakRpm: 4200,
        maxRpm: 6500,
        engineBraking: 60,
        gearCount: 5,
        firstGearRatio: 3.4,
        topGearRatio: 0.8,
        reverseGearRatio: 3.2,
        finalDriveRatio: 3.7,
        maxSteerAngle: 32,
        steerSpeed: 140,
        highSpeedSteering: 0.35,
        ackermann: 0.6,
        brakeTorque: 2200,
        handbrakeTorque: 4000,
        bodyRoll: 0.4,
        airDrag: 0.42,
        ...overrides,
    };
}
export function cloneVehicleSettings(settings: VehicleSettings): VehicleSettings {
    return { ...settings };
}
export function clampVehicleScalar(key: VehicleScalar, value: number): number {
    const [min, max] = VEHICLE_SCALAR_RANGE[key];
    const clamped = clamp(value, min, max);
    return key === 'gearCount' ? Math.round(clamped) : clamped;
}
export function normalizeVehicleSettings(settings: VehicleSettings): VehicleSettings {
    const normalized = createVehicleSettings();
    if (VEHICLE_CONTROLS.includes(settings.control))
        normalized.control = settings.control;
    for (const key of VEHICLE_SCALARS) {
        if (Number.isFinite(settings[key]))
            normalized[key] = clampVehicleScalar(key, settings[key]);
    }
    normalized.maxRpm = Math.max(normalized.maxRpm, normalized.idleRpm + 2 * MIN_REV_BAND);
    normalized.peakRpm = clamp(normalized.peakRpm, normalized.idleRpm + MIN_REV_BAND, normalized.maxRpm - MIN_REV_BAND);
    normalized.topGearRatio = Math.min(normalized.topGearRatio, normalized.firstGearRatio);
    return normalized;
}
