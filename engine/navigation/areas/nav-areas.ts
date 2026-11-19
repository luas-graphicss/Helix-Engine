import { clamp } from '@/engine/core/math/scalar';
export const NAV_AREA_COUNT = 8;
export const WALKABLE_AREA = 0;
export const NOT_WALKABLE_AREA = 1;
export const JUMP_AREA = 2;
export const ALL_AREAS_MASK = (1 << NAV_AREA_COUNT) - 1;
const BUILT_IN_AREA_NAMES = ['Caminhável', 'Não caminhável', 'Salto'] as const;
const DEFAULT_AREA_COST = 1;
const DEFAULT_JUMP_COST = 2;
const MIN_AREA_COST = 1;
const MAX_AREA_COST = 100;
const MAX_AREA_NAME_LENGTH = 24;
export interface NavArea {
    name: string;
    cost: number;
}
export interface NavigationSettings {
    areas: NavArea[];
}
function defaultAreaName(area: number): string {
    return isBuiltInArea(area) ? BUILT_IN_AREA_NAMES[area] : `Área ${area}`;
}
function defaultAreaCost(area: number): number {
    return area === JUMP_AREA ? DEFAULT_JUMP_COST : DEFAULT_AREA_COST;
}
export function isBuiltInArea(area: number): boolean {
    return area < BUILT_IN_AREA_NAMES.length;
}
export function clampAreaIndex(area: number): number {
    return Number.isFinite(area) ? clamp(Math.round(area), 0, NAV_AREA_COUNT - 1) : WALKABLE_AREA;
}
export function clampAreaCost(cost: number): number {
    return clamp(cost, MIN_AREA_COST, MAX_AREA_COST);
}
export function clampAreaMask(mask: number): number {
    return Number.isFinite(mask) ? Math.trunc(mask) & ALL_AREAS_MASK : ALL_AREAS_MASK;
}
export function areaBit(area: number): number {
    return 1 << area;
}
export function sanitizeAreaName(area: number, name: string): string {
    const trimmed = name.trim().slice(0, MAX_AREA_NAME_LENGTH);
    return isBuiltInArea(area) || trimmed.length === 0 ? defaultAreaName(area) : trimmed;
}
export function createNavigationSettings(): NavigationSettings {
    const areas: NavArea[] = [];
    for (let area = 0; area < NAV_AREA_COUNT; area++)
        areas.push({ name: defaultAreaName(area), cost: defaultAreaCost(area) });
    return { areas };
}
export function normalizeNavigationSettings(settings: NavigationSettings): NavigationSettings {
    const normalized = createNavigationSettings();
    const stored = Array.isArray(settings.areas) ? settings.areas : [];
    for (let area = 0; area < NAV_AREA_COUNT; area++) {
        const candidate = stored[area];
        if (!candidate)
            continue;
        if (typeof candidate.name === 'string')
            normalized.areas[area].name = sanitizeAreaName(area, candidate.name);
        if (Number.isFinite(candidate.cost))
            normalized.areas[area].cost = clampAreaCost(candidate.cost);
    }
    return normalized;
}
export function areaCostTable(settings: NavigationSettings): Float32Array {
    const costs = new Float32Array(NAV_AREA_COUNT);
    for (let area = 0; area < NAV_AREA_COUNT; area++)
        costs[area] = settings.areas[area].cost;
    return costs;
}
