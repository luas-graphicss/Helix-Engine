export interface CsgPreferences {
    ghostOpacity: number;
    deferHeavyWhileDragging: boolean;
    autoMeshCollider: boolean;
}
export const DEFAULT_GHOST_OPACITY = 0.32;
export function createCsgPreferences(): CsgPreferences {
    return { ghostOpacity: DEFAULT_GHOST_OPACITY, deferHeavyWhileDragging: true, autoMeshCollider: true };
}
