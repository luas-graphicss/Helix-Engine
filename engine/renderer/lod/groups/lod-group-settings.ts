export const MAX_LOD_GROUP_LEVELS = 8;
export const MIN_LOD_SCREEN_HEIGHT = 0.001;
export const MAX_LOD_SCREEN_HEIGHT = 1;
const FIRST_SCREEN_HEIGHT = 0.5;
const LEVEL_RATIO = 0.4;
const CULL_SCREEN_HEIGHT = 0.02;
const MIN_LEVEL_GAP = 0.0005;
const MIN_RADIUS = 1e-4;
export interface LodGroupSettings {
    screenHeights: number[];
    radius: number;
}
function defaultScreenHeight(level: number, levelCount: number, previous: number): number {
    if (level === levelCount - 1)
        return Math.min(CULL_SCREEN_HEIGHT, previous * LEVEL_RATIO);
    return FIRST_SCREEN_HEIGHT * LEVEL_RATIO ** level;
}
export function createLodGroupSettings(levelCount = 0, radius = 1): LodGroupSettings {
    return resizeLodGroupLevels({ screenHeights: [], radius }, levelCount);
}
export function cloneLodGroupSettings(settings: LodGroupSettings): LodGroupSettings {
    return { screenHeights: [...settings.screenHeights], radius: settings.radius };
}
export function resizeLodGroupLevels(settings: LodGroupSettings, levelCount: number): LodGroupSettings {
    const count = Math.max(0, Math.min(Math.floor(levelCount), MAX_LOD_GROUP_LEVELS));
    const screenHeights = settings.screenHeights.slice(0, count);
    while (screenHeights.length < count) {
        const previous = screenHeights[screenHeights.length - 1] ?? MAX_LOD_SCREEN_HEIGHT;
        const fresh = settings.screenHeights.length === 0 ? defaultScreenHeight(screenHeights.length, count, previous) : previous * LEVEL_RATIO;
        screenHeights.push(fresh);
    }
    return normalizeLodGroupSettings({ screenHeights, radius: settings.radius });
}
export function normalizeLodGroupSettings(settings: LodGroupSettings): LodGroupSettings {
    const source = Array.isArray(settings.screenHeights) ? settings.screenHeights.slice(0, MAX_LOD_GROUP_LEVELS) : [];
    const screenHeights: number[] = [];
    let ceiling = MAX_LOD_SCREEN_HEIGHT;
    for (let level = 0; level < source.length; level++) {
        const floor = MIN_LOD_SCREEN_HEIGHT + MIN_LEVEL_GAP * (source.length - 1 - level);
        const value = Number.isFinite(source[level]) ? source[level] : ceiling;
        const clamped = Math.max(floor, Math.min(value, ceiling));
        screenHeights.push(clamped);
        ceiling = clamped - MIN_LEVEL_GAP;
    }
    const radius = Number.isFinite(settings.radius) ? Math.max(settings.radius, MIN_RADIUS) : 1;
    return { screenHeights, radius };
}
