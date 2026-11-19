import { clamp } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clampAreaIndex, JUMP_AREA, NOT_WALKABLE_AREA } from '../areas/nav-areas';
export interface NavLinkSettings {
    start: Vec3;
    end: Vec3;
    bidirectional: boolean;
    costOverride: number;
    area: number;
    enabled: boolean;
}
export const NAV_LINK_ENDPOINTS = ['start', 'end'] as const;
export type NavLinkEndpoint = (typeof NAV_LINK_ENDPOINTS)[number];
const LINK_FLAGS = ['bidirectional', 'enabled'] as const;
export type NavLinkFlag = (typeof LINK_FLAGS)[number];
export const AREA_COST = -1;
const MAX_LINK_COST = 1000;
const MAX_LINK_OFFSET = 1000;
const DEFAULT_HALF_SPAN = 1.5;
export function createNavLinkSettings(overrides: Partial<NavLinkSettings> = {}): NavLinkSettings {
    return {
        start: vec3.create(0, 0, -DEFAULT_HALF_SPAN),
        end: vec3.create(0, 0, DEFAULT_HALF_SPAN),
        bidirectional: true,
        costOverride: AREA_COST,
        area: JUMP_AREA,
        enabled: true,
        ...overrides,
    };
}
export function cloneNavLinkSettings(settings: NavLinkSettings): NavLinkSettings {
    return { ...settings, start: vec3.copy(vec3.create(), settings.start), end: vec3.copy(vec3.create(), settings.end) };
}
export function clampNavLinkCost(cost: number): number {
    return cost < 0 ? AREA_COST : Math.min(cost, MAX_LINK_COST);
}
export function clampNavLinkOffset(value: number): number {
    return clamp(value, -MAX_LINK_OFFSET, MAX_LINK_OFFSET);
}
export function clampNavLinkArea(area: number): number {
    const clamped = clampAreaIndex(area);
    return clamped === NOT_WALKABLE_AREA ? JUMP_AREA : clamped;
}
export function normalizeNavLinkSettings(settings: NavLinkSettings): NavLinkSettings {
    const normalized = createNavLinkSettings();
    for (const flag of LINK_FLAGS) {
        if (typeof settings[flag] === 'boolean')
            normalized[flag] = settings[flag];
    }
    if (Number.isFinite(settings.costOverride))
        normalized.costOverride = clampNavLinkCost(settings.costOverride);
    normalized.area = clampNavLinkArea(settings.area);
    for (const endpoint of NAV_LINK_ENDPOINTS) {
        for (let axis = 0; axis < 3; axis++) {
            if (Number.isFinite(settings[endpoint]?.[axis]))
                normalized[endpoint][axis] = clampNavLinkOffset(settings[endpoint][axis]);
        }
    }
    return normalized;
}
