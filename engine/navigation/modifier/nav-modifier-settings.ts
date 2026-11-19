import { clamp } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clampAreaIndex, NOT_WALKABLE_AREA } from '../areas/nav-areas';
export const NAV_MODIFIER_MODES = ['area', 'ignore', 'volume'] as const;
export type NavModifierMode = (typeof NAV_MODIFIER_MODES)[number];
export interface NavModifierSettings {
    mode: NavModifierMode;
    area: number;
    size: Vec3;
    center: Vec3;
}
const MIN_VOLUME_SIZE = 0.1;
const MAX_VOLUME_SIZE = 2000;
const MAX_VOLUME_OFFSET = 1000;
export function createNavModifierSettings(overrides: Partial<NavModifierSettings> = {}): NavModifierSettings {
    return {
        mode: 'volume',
        area: NOT_WALKABLE_AREA,
        size: vec3.create(4, 2, 4),
        center: vec3.create(),
        ...overrides,
    };
}
export function cloneNavModifierSettings(settings: NavModifierSettings): NavModifierSettings {
    return { ...settings, size: vec3.copy(vec3.create(), settings.size), center: vec3.copy(vec3.create(), settings.center) };
}
export function clampNavModifierSize(value: number): number {
    return clamp(value, MIN_VOLUME_SIZE, MAX_VOLUME_SIZE);
}
export function clampNavModifierOffset(value: number): number {
    return clamp(value, -MAX_VOLUME_OFFSET, MAX_VOLUME_OFFSET);
}
export function normalizeNavModifierSettings(settings: NavModifierSettings): NavModifierSettings {
    const normalized = createNavModifierSettings();
    if (NAV_MODIFIER_MODES.includes(settings.mode))
        normalized.mode = settings.mode;
    normalized.area = clampAreaIndex(settings.area);
    for (let axis = 0; axis < 3; axis++) {
        if (Number.isFinite(settings.size?.[axis]))
            normalized.size[axis] = clampNavModifierSize(settings.size[axis]);
        if (Number.isFinite(settings.center?.[axis]))
            normalized.center[axis] = clampNavModifierOffset(settings.center[axis]);
    }
    return normalized;
}
