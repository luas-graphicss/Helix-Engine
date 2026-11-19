import { createVehicleSettings, type VehicleSettings } from './vehicle-settings';
import { createWheelSettings, type WheelSettings } from './wheel/wheel-settings';
const VEHICLE_PRESET_IDS = ['car', 'offroad', 'truck', 'kart'] as const;
export type VehiclePresetId = (typeof VEHICLE_PRESET_IDS)[number];
type Triple = readonly [number, number, number];
export interface AxleBlueprint {
    readonly offset: number;
    readonly halfTrack: number;
    readonly wheelWidth: number;
    readonly wheel: Readonly<WheelSettings>;
}
export interface VehicleBlueprint {
    readonly chassisSize: Triple;
    readonly chassisMass: number;
    readonly groundClearance: number;
    readonly cabinSize: Triple;
    readonly cabinOffset: number;
    readonly color: Triple;
    readonly axles: readonly AxleBlueprint[];
}
export interface VehiclePreset {
    readonly id: VehiclePresetId;
    readonly label: string;
    readonly description: string;
    readonly settings: Readonly<VehicleSettings>;
    readonly blueprint: VehicleBlueprint;
}
const OFFROAD_WHEEL = { radius: 0.45, mass: 28, suspensionTravel: 0.4, suspensionFrequency: 1.4, suspensionDamping: 0.5 } satisfies Partial<WheelSettings>;
const TRUCK_WHEEL = { radius: 0.52, mass: 60, suspensionTravel: 0.3, suspensionFrequency: 1.6, suspensionDamping: 0.55 } satisfies Partial<WheelSettings>;
const KART_WHEEL = { mass: 3, suspensionTravel: 0.05, suspensionFrequency: 4, suspensionDamping: 0.6 } satisfies Partial<WheelSettings>;
export const VEHICLE_PRESETS: readonly VehiclePreset[] = [
    {
        id: 'car',
        label: 'Carro',
        description: 'Sedã de tração traseira: quatro rodas, direção na frente e freio de mão atrás',
        settings: createVehicleSettings(),
        blueprint: {
            chassisSize: [1.8, 0.5, 4.2],
            chassisMass: 1300,
            groundClearance: 0.22,
            cabinSize: [1.5, 0.45, 2],
            cabinOffset: -0.3,
            color: [0.62, 0.1, 0.09],
            axles: [
                { offset: 1.3, halfTrack: 0.82, wheelWidth: 0.24, wheel: createWheelSettings({ steering: true }) },
                { offset: -1.3, halfTrack: 0.82, wheelWidth: 0.24, wheel: createWheelSettings({ driven: true, handbrake: true }) },
            ],
        },
    },
    {
        id: 'offroad',
        label: 'Jipe 4×4',
        description: 'Tração nas quatro rodas, pneus grandes e suspensão de curso longo',
        settings: createVehicleSettings({ maxTorque: 450, peakRpm: 3000, maxRpm: 5200, firstGearRatio: 3.8, topGearRatio: 0.85, finalDriveRatio: 4.3, maxSteerAngle: 34, brakeTorque: 3000, bodyRoll: 0.3, airDrag: 0.7 }),
        blueprint: {
            chassisSize: [1.9, 0.6, 4],
            chassisMass: 1900,
            groundClearance: 0.42,
            cabinSize: [1.7, 0.6, 2.2],
            cabinOffset: -0.4,
            color: [0.24, 0.3, 0.18],
            axles: [
                { offset: 1.25, halfTrack: 0.9, wheelWidth: 0.3, wheel: createWheelSettings({ ...OFFROAD_WHEEL, steering: true, driven: true }) },
                { offset: -1.25, halfTrack: 0.9, wheelWidth: 0.3, wheel: createWheelSettings({ ...OFFROAD_WHEEL, driven: true, handbrake: true }) },
            ],
        },
    },
    {
        id: 'truck',
        label: 'Caminhão',
        description: 'Seis rodas: eixo dianteiro direcional e dois eixos traseiros de tração',
        settings: createVehicleSettings({ maxTorque: 1600, idleRpm: 600, peakRpm: 1300, maxRpm: 2600, engineBraking: 300, gearCount: 8, firstGearRatio: 7.5, reverseGearRatio: 7, finalDriveRatio: 4.6, maxSteerAngle: 38, steerSpeed: 90, highSpeedSteering: 0.3, brakeTorque: 9000, handbrakeTorque: 16000, bodyRoll: 0.25, airDrag: 3.5 }),
        blueprint: {
            chassisSize: [2.4, 0.9, 7.5],
            chassisMass: 9000,
            groundClearance: 0.55,
            cabinSize: [2.3, 1.5, 2],
            cabinOffset: 2.6,
            color: [0.82, 0.62, 0.12],
            axles: [
                { offset: 2.7, halfTrack: 1.05, wheelWidth: 0.36, wheel: createWheelSettings({ ...TRUCK_WHEEL, steering: true }) },
                { offset: -1.6, halfTrack: 1.05, wheelWidth: 0.36, wheel: createWheelSettings({ ...TRUCK_WHEEL, driven: true, handbrake: true }) },
                { offset: -2.9, halfTrack: 1.05, wheelWidth: 0.36, wheel: createWheelSettings({ ...TRUCK_WHEEL, driven: true, handbrake: true }) },
            ],
        },
    },
    {
        id: 'kart',
        label: 'Kart',
        description: 'Leve e baixo, com uma marcha só e respostas rápidas',
        settings: createVehicleSettings({ maxTorque: 22, idleRpm: 1800, peakRpm: 6500, maxRpm: 9500, engineBraking: 4, gearCount: 1, firstGearRatio: 1, topGearRatio: 1, reverseGearRatio: 1, finalDriveRatio: 6.5, maxSteerAngle: 28, steerSpeed: 240, highSpeedSteering: 0.6, ackermann: 0.8, brakeTorque: 260, handbrakeTorque: 400, bodyRoll: 0.2, airDrag: 0.25 }),
        blueprint: {
            chassisSize: [1.1, 0.2, 1.7],
            chassisMass: 160,
            groundClearance: 0.06,
            cabinSize: [0.45, 0.4, 0.45],
            cabinOffset: -0.3,
            color: [0.1, 0.32, 0.62],
            axles: [
                { offset: 0.55, halfTrack: 0.5, wheelWidth: 0.13, wheel: createWheelSettings({ ...KART_WHEEL, radius: 0.13, steering: true }) },
                { offset: -0.55, halfTrack: 0.55, wheelWidth: 0.2, wheel: createWheelSettings({ ...KART_WHEEL, radius: 0.14, driven: true, handbrake: true }) },
            ],
        },
    },
];
export function getVehiclePreset(id: VehiclePresetId): VehiclePreset {
    const preset = VEHICLE_PRESETS.find((candidate) => candidate.id === id);
    if (!preset)
        throw new Error(`Unknown vehicle preset "${id}"`);
    return preset;
}
