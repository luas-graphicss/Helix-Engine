import { clamp } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clampAreaIndex, NOT_WALKABLE_AREA, WALKABLE_AREA } from '../areas/nav-areas';
export const NAV_COLLECT_MODES = ['scene', 'children', 'volume'] as const;
export type NavCollectMode = (typeof NAV_COLLECT_MODES)[number];
export interface NavSurfaceSettings {
    agentRadius: number;
    agentHeight: number;
    maxSlope: number;
    stepHeight: number;
    cellSize: number;
    minRegionArea: number;
    collect: NavCollectMode;
    volumeSize: Vec3;
    volumeCenter: Vec3;
    defaultArea: number;
}
const SURFACE_SCALAR_RANGE = {
    agentRadius: [0.05, 5],
    agentHeight: [0.2, 20],
    maxSlope: [0, 75],
    stepHeight: [0, 5],
    cellSize: [0.05, 2],
    minRegionArea: [0, 100],
} as const satisfies Partial<Record<keyof NavSurfaceSettings, readonly [number, number]>>;
export type NavSurfaceScalar = keyof typeof SURFACE_SCALAR_RANGE;
const SURFACE_SCALARS = Object.keys(SURFACE_SCALAR_RANGE) as NavSurfaceScalar[];
const MIN_VOLUME_SIZE = 0.5;
const MAX_VOLUME_SIZE = 2000;
const MAX_VOLUME_OFFSET = 1000;
export function createNavSurfaceSettings(overrides: Partial<NavSurfaceSettings> = {}): NavSurfaceSettings {
    return {
        agentRadius: 0.4,
        agentHeight: 1.8,
        maxSlope: 45,
        stepHeight: 0.4,
        cellSize: 0.25,
        minRegionArea: 2,
        collect: 'scene',
        volumeSize: vec3.create(20, 10, 20),
        volumeCenter: vec3.create(),
        defaultArea: WALKABLE_AREA,
        ...overrides,
    };
}
export function cloneNavSurfaceSettings(settings: NavSurfaceSettings): NavSurfaceSettings {
    return { ...settings, volumeSize: vec3.copy(vec3.create(), settings.volumeSize), volumeCenter: vec3.copy(vec3.create(), settings.volumeCenter) };
}
export function clampNavSurfaceScalar(key: NavSurfaceScalar, value: number): number {
    const [min, max] = SURFACE_SCALAR_RANGE[key];
    return clamp(value, min, max);
}
export function clampNavVolumeSize(value: number): number {
    return clamp(value, MIN_VOLUME_SIZE, MAX_VOLUME_SIZE);
}
export function clampNavVolumeOffset(value: number): number {
    return clamp(value, -MAX_VOLUME_OFFSET, MAX_VOLUME_OFFSET);
}
export function clampBakedArea(area: number): number {
    const clamped = clampAreaIndex(area);
    return clamped === NOT_WALKABLE_AREA ? WALKABLE_AREA : clamped;
}
export function normalizeNavSurfaceSettings(settings: NavSurfaceSettings): NavSurfaceSettings {
    const normalized = createNavSurfaceSettings();
    for (const key of SURFACE_SCALARS) {
        if (Number.isFinite(settings[key]))
            normalized[key] = clampNavSurfaceScalar(key, settings[key]);
    }
    if (NAV_COLLECT_MODES.includes(settings.collect))
        normalized.collect = settings.collect;
    normalized.defaultArea = clampBakedArea(settings.defaultArea);
    for (let axis = 0; axis < 3; axis++) {
        if (Number.isFinite(settings.volumeSize?.[axis]))
            normalized.volumeSize[axis] = clampNavVolumeSize(settings.volumeSize[axis]);
        if (Number.isFinite(settings.volumeCenter?.[axis]))
            normalized.volumeCenter[axis] = clampNavVolumeOffset(settings.volumeCenter[axis]);
    }
    return normalized;
}
