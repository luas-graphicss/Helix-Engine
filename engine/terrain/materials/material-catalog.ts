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
export interface HiresMapSource {
    readonly url: string;
    readonly size: number;
}
export type HiresMapKind = 'albedo' | 'normal';
export type HiresMapSources = Readonly<Record<HiresMapKind, HiresMapSource | null>>;
export const NO_HIRES_SOURCES: HiresMapSources = { albedo: null, normal: null };
export const CATALOG_HIRES_SIZE = 8192;
const POLY_HAVEN_FILES = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/8k';
export function catalogHiresSources(entry: CatalogMaterial): HiresMapSources {
    const match = /^https:\/\/polyhaven\.com\/a\/([a-z0-9_]+)$/i.exec(entry.credit.url);
    if (!match)
        return NO_HIRES_SOURCES;
    const slug = match[1];
    return {
        albedo: { url: `${POLY_HAVEN_FILES}/${slug}/${slug}_diff_8k.jpg`, size: CATALOG_HIRES_SIZE },
        normal: { url: `${POLY_HAVEN_FILES}/${slug}/${slug}_nor_gl_8k.jpg`, size: CATALOG_HIRES_SIZE },
    };
}
