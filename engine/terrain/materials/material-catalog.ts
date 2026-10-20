import type { TerrainMaterialCategory } from './terrain-material';
export type TerrainFoliageKind = 'grass';
export interface MaterialCredit {
    asset: string;
    author: string;
    url: string;
    license: string;
}
export interface CatalogMaterial {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly category: TerrainMaterialCategory;
    readonly folder: string;
    readonly defaultTiling: number;
    readonly normalStrength: number;
    readonly roughness: number;
    readonly foliage: TerrainFoliageKind | null;
    readonly averageColor: readonly [
        number,
        number,
        number
    ];
    readonly credit: MaterialCredit;
}
export function catalogMapUrls(entry: CatalogMaterial): {
    albedo: string;
    normal: string;
    ormh: string;
} {
    return {
        albedo: `${entry.folder}/albedo.webp`,
        normal: `${entry.folder}/normal.webp`,
        ormh: `${entry.folder}/ormh.webp`,
    };
}
