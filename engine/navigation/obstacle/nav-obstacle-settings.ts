import { clamp } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export const NAV_OBSTACLE_SHAPES = ['box', 'capsule'] as const;
export type NavObstacleShape = (typeof NAV_OBSTACLE_SHAPES)[number];
export interface NavObstacleSettings {
    shape: NavObstacleShape;
    center: Vec3;
    size: Vec3;
    carve: boolean;
    carveOnlyStationary: boolean;
    moveThreshold: number;
    timeToStationary: number;
}
const OBSTACLE_SCALAR_RANGE = {
    moveThreshold: [0.01, 10],
    timeToStationary: [0, 10],
} as const satisfies Partial<Record<keyof NavObstacleSettings, readonly [number, number]>>;
export type NavObstacleScalar = keyof typeof OBSTACLE_SCALAR_RANGE;
const OBSTACLE_SCALARS = Object.keys(OBSTACLE_SCALAR_RANGE) as NavObstacleScalar[];
const OBSTACLE_FLAGS = ['carve', 'carveOnlyStationary'] as const;
export type NavObstacleFlag = (typeof OBSTACLE_FLAGS)[number];
const MIN_SIZE = 0.05;
const MAX_SIZE = 100;
const MAX_CENTER_OFFSET = 100;
export function createNavObstacleSettings(overrides: Partial<NavObstacleSettings> = {}): NavObstacleSettings {
    return {
        shape: 'box',
        center: vec3.create(),
        size: vec3.create(1, 1, 1),
        carve: true,
        carveOnlyStationary: true,
        moveThreshold: 0.1,
        timeToStationary: 0.5,
        ...overrides,
    };
}
export function cloneNavObstacleSettings(settings: NavObstacleSettings): NavObstacleSettings {
    return { ...settings, center: vec3.copy(vec3.create(), settings.center), size: vec3.copy(vec3.create(), settings.size) };
}
export function clampNavObstacleScalar(key: NavObstacleScalar, value: number): number {
    const [min, max] = OBSTACLE_SCALAR_RANGE[key];
    return clamp(value, min, max);
}
export function clampNavObstacleSize(value: number): number {
    return clamp(value, MIN_SIZE, MAX_SIZE);
}
export function clampNavObstacleCenter(value: number): number {
    return clamp(value, -MAX_CENTER_OFFSET, MAX_CENTER_OFFSET);
}
export function normalizeNavObstacleSettings(settings: NavObstacleSettings): NavObstacleSettings {
    const normalized = createNavObstacleSettings();
    if (NAV_OBSTACLE_SHAPES.includes(settings.shape))
        normalized.shape = settings.shape;
    for (const key of OBSTACLE_SCALARS) {
        if (Number.isFinite(settings[key]))
            normalized[key] = clampNavObstacleScalar(key, settings[key]);
    }
    for (const flag of OBSTACLE_FLAGS) {
        if (typeof settings[flag] === 'boolean')
            normalized[flag] = settings[flag];
    }
    for (let axis = 0; axis < 3; axis++) {
        if (Number.isFinite(settings.size?.[axis]))
            normalized.size[axis] = clampNavObstacleSize(settings.size[axis]);
        if (Number.isFinite(settings.center?.[axis]))
            normalized.center[axis] = clampNavObstacleCenter(settings.center[axis]);
    }
    return normalized;
}
