import type { Vec3 } from '@/engine/core/math/vec3';
import type { Texture } from '@/engine/core/scene/texture';
import type { MaterialCredit, TerrainFoliageKind } from './material-catalog';
export type TerrainMaterialCategory = 'grass' | 'soil' | 'rock' | 'sand' | 'snow' | 'custom';
export const TERRAIN_MATERIAL_CATEGORY_LABEL: Record<TerrainMaterialCategory, string> = {
    grass: 'Vegetação',
    soil: 'Solo',
    rock: 'Rocha',
    sand: 'Areia',
    snow: 'Neve',
    custom: 'Personalizado',
};
export type TerrainMapKind = 'albedo' | 'normal' | 'ormh';
export const TERRAIN_COLOR_TEXTURE_SIZE = 1024;
export const TERRAIN_DATA_TEXTURE_SIZE = 512;
export function terrainMapSize(kind: TerrainMapKind): number {
    return kind === 'ormh' ? TERRAIN_DATA_TEXTURE_SIZE : TERRAIN_COLOR_TEXTURE_SIZE;
}
export interface TerrainMaterial {
    readonly id: string;
    name: string;
    description: string;
    category: TerrainMaterialCategory;
    albedo: Texture | null;
    normal: Texture | null;
    ormh: Texture | null;
    roughness: number;
    defaultTiling: number;
    defaultNormalStrength: number;
    readonly averageColor: Vec3;
    foliage: TerrainFoliageKind | null;
    readonly source: 'catalog' | 'custom';
    readonly thumbnailUrl: string | null;
    readonly credit: MaterialCredit | null;
    pendingMaps: number;
}
export function terrainMaterialSignature(material: TerrainMaterial): string {
    const version = (texture: Texture | null) => (texture?.image ? `${texture.id}.${texture.version}` : '-');
    return `${material.id}|${version(material.albedo)}|${version(material.normal)}|${version(material.ormh)}|${material.roughness}`;
}
