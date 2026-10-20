import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { TerrainMaterial } from '@/engine/terrain/materials/terrain-material';
export interface TerrainAutoRule {
    enabled: boolean;
    slopeMin: number;
    slopeMax: number;
    heightMin: number;
    heightMax: number;
    softness: number;
}
export interface TerrainLayer {
    readonly id: number;
    name: string;
    material: TerrainMaterial;
    tiling: number;
    tint: Vec3;
    normalStrength: number;
    roughness: number;
    auto: TerrainAutoRule;
}
let nextLayerId = 1;
export function createAutoRule(overrides: Partial<TerrainAutoRule> = {}): TerrainAutoRule {
    return { enabled: false, slopeMin: 0, slopeMax: 90, heightMin: 0, heightMax: 1, softness: 0.2, ...overrides };
}
export function createTerrainLayer(material: TerrainMaterial, overrides: Partial<Omit<TerrainLayer, 'id' | 'material'>> = {}): TerrainLayer {
    return {
        id: nextLayerId++,
        name: overrides.name ?? material.name,
        material,
        tiling: overrides.tiling ?? material.defaultTiling,
        tint: overrides.tint ? vec3.copy(vec3.create(), overrides.tint) : vec3.create(1, 1, 1),
        normalStrength: overrides.normalStrength ?? material.defaultNormalStrength,
        roughness: overrides.roughness ?? 1,
        auto: overrides.auto ? { ...overrides.auto } : createAutoRule(),
    };
}
export function cloneTerrainLayer(layer: TerrainLayer): TerrainLayer {
    return { ...layer, tint: vec3.copy(vec3.create(), layer.tint), auto: { ...layer.auto } };
}
