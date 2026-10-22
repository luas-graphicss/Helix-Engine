import * as vec3 from '@/engine/core/math/vec3';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import type { CsgOperation } from '@/engine/geometry/csg/csg-settings';
import { DEFAULT_GHOST_OPACITY } from '@/engine/editor/session/csg-preferences';
const GHOST_MATERIALS: Record<CsgOperation, Material> = {
    subtract: createMaterial({ name: 'Pincel · Subtrair', baseColor: vec3.create(0.95, 0.42, 0.18), opacity: DEFAULT_GHOST_OPACITY, alphaMode: 'blend', roughness: 0.9 }),
    union: createMaterial({ name: 'Pincel · Unir', baseColor: vec3.create(0.32, 0.78, 0.42), opacity: DEFAULT_GHOST_OPACITY, alphaMode: 'blend', roughness: 0.9 }),
    intersect: createMaterial({ name: 'Pincel · Interseção', baseColor: vec3.create(0.3, 0.58, 0.95), opacity: DEFAULT_GHOST_OPACITY, alphaMode: 'blend', roughness: 0.9 }),
};
export function brushMaterial(operation: CsgOperation): Material {
    return GHOST_MATERIALS[operation];
}
export function isBrushMaterial(material: Material | null): boolean {
    return material !== null && Object.values(GHOST_MATERIALS).includes(material);
}
export function releasedMaterial(): Material {
    return createMaterial({ baseColor: vec3.create(0.7, 0.7, 0.7), roughness: 0.6 });
}
export function setGhostOpacity(opacity: number): void {
    const clamped = Math.min(Math.max(opacity, 0.05), 1);
    for (const material of Object.values(GHOST_MATERIALS))
        material.opacity = clamped;
}
