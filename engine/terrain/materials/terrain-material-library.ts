import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { createTexture, setTextureImage, type Texture, type TextureImage } from '@/engine/core/scene/texture';
import { decodeImageFromUri } from '@/engine/assets/image-decoder';
import { catalogMapUrls, type CatalogMaterial, type MaterialCredit, type TerrainFoliageKind } from './material-catalog';
import { TERRAIN_MATERIAL_CATALOG } from './material-catalog.generated';
import { packOrmh, readImagePixels } from './ormh-packer';
import type { TerrainMaterial, TerrainMaterialCategory } from './terrain-material';
export interface TerrainMaterialInfo {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly category: TerrainMaterialCategory;
    readonly defaultTiling: number;
    readonly averageColor: Vec3;
    readonly foliage: TerrainFoliageKind | null;
    readonly source: 'catalog' | 'custom';
    readonly thumbnailUrl: string | null;
    readonly credit: MaterialCredit | null;
    readonly loading: boolean;
}
export interface CustomMaterialMaps {
    albedo: TextureImage | null;
    normal: TextureImage | null;
    roughness: TextureImage | null;
    occlusion: TextureImage | null;
    height: TextureImage | null;
}
const DEFAULT_CUSTOM_TILING = 3;
const DEFAULT_CUSTOM_ROUGHNESS = 0.8;
const THUMBNAIL_SAMPLE_SIZE = 16;
function averageLinearColor(image: TextureImage): Vec3 {
    const pixels = readImagePixels(image, THUMBNAIL_SAMPLE_SIZE);
    const out = vec3.create();
    for (let i = 0; i < pixels.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            const srgb = pixels[i + c] / 255;
            out[c] += srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
        }
    }
    return vec3.scale(out, out, 4 / pixels.length);
}
function getCatalogEntry(id: string): CatalogMaterial | null {
    return TERRAIN_MATERIAL_CATALOG.find((entry) => entry.id === id) ?? null;
}
export class TerrainMaterialLibrary {
    private readonly materials = new Map<string, TerrainMaterial>();
    private readonly customSources = new Map<string, CustomMaterialMaps>();
    private nextCustomId = 1;
    constructor(private readonly onChange: () => void = () => { }) { }
    list(): TerrainMaterialInfo[] {
        const catalog = TERRAIN_MATERIAL_CATALOG.map((entry): TerrainMaterialInfo => {
            const material = this.materials.get(entry.id);
            return {
                id: entry.id,
                name: entry.name,
                description: entry.description,
                category: entry.category,
                defaultTiling: entry.defaultTiling,
                averageColor: material?.averageColor ?? vec3.create(...entry.averageColor),
                foliage: entry.foliage,
                source: 'catalog',
                thumbnailUrl: catalogMapUrls(entry).albedo,
                credit: entry.credit,
                loading: (material?.pendingMaps ?? 0) > 0,
            };
        });
        const custom = Array.from(this.materials.values())
            .filter((material) => material.source === 'custom')
            .map((material): TerrainMaterialInfo => ({
            id: material.id,
            name: material.name,
            description: material.description,
            category: material.category,
            defaultTiling: material.defaultTiling,
            averageColor: material.averageColor,
            foliage: material.foliage,
            source: 'custom',
            thumbnailUrl: null,
            credit: null,
            loading: false,
        }));
        return [...catalog, ...custom];
    }
    info(id: string): TerrainMaterialInfo | null {
        return this.list().find((entry) => entry.id === id) ?? null;
    }
    has(id: string): boolean {
        return this.materials.has(id) || getCatalogEntry(id) !== null;
    }
    get(id: string): TerrainMaterial | null {
        const existing = this.materials.get(id);
        if (existing)
            return existing;
        const entry = getCatalogEntry(id);
        if (!entry)
            return null;
        const urls = catalogMapUrls(entry);
        const material: TerrainMaterial = {
            id: entry.id,
            name: entry.name,
            description: entry.description,
            category: entry.category,
            albedo: createTexture({ name: `${entry.name} · Albedo`, colorSpace: 'srgb', sourcePath: urls.albedo }),
            normal: createTexture({ name: `${entry.name} · Normal`, colorSpace: 'linear', sourcePath: urls.normal }),
            ormh: createTexture({ name: `${entry.name} · ORMH`, colorSpace: 'linear', sourcePath: urls.ormh }),
            roughness: entry.roughness,
            defaultTiling: entry.defaultTiling,
            defaultNormalStrength: entry.normalStrength,
            averageColor: vec3.create(...entry.averageColor),
            foliage: entry.foliage,
            source: 'catalog',
            thumbnailUrl: urls.albedo,
            credit: entry.credit,
            pendingMaps: 0,
        };
        this.materials.set(id, material);
        if (typeof window !== 'undefined') {
            this.load(material, material.albedo);
            this.load(material, material.normal);
            this.load(material, material.ormh);
        }
        return material;
    }
    createCustom(name: string, maps: CustomMaterialMaps): TerrainMaterial {
        const id = `custom-${this.nextCustomId++}`;
        const material: TerrainMaterial = {
            id,
            name,
            description: 'Material PBR personalizado',
            category: 'custom',
            albedo: null,
            normal: null,
            ormh: null,
            roughness: DEFAULT_CUSTOM_ROUGHNESS,
            defaultTiling: DEFAULT_CUSTOM_TILING,
            defaultNormalStrength: 1,
            averageColor: vec3.create(0.5, 0.5, 0.5),
            foliage: null,
            source: 'custom',
            thumbnailUrl: null,
            credit: null,
            pendingMaps: 0,
        };
        this.materials.set(id, material);
        this.updateCustomMaps(id, maps);
        return material;
    }
    updateCustomMaps(id: string, maps: Partial<CustomMaterialMaps>): void {
        const material = this.materials.get(id);
        if (!material || material.source !== 'custom')
            return;
        const current = this.customSources.get(id) ?? { albedo: null, normal: null, roughness: null, occlusion: null, height: null };
        const merged: CustomMaterialMaps = { ...current, ...maps };
        this.customSources.set(id, merged);
        material.albedo = this.replaceTexture(material.albedo, `${material.name} · Albedo`, merged.albedo, 'srgb');
        material.normal = this.replaceTexture(material.normal, `${material.name} · Normal`, merged.normal, 'linear');
        const hasOrmh = merged.roughness || merged.occlusion || merged.height;
        const packed = hasOrmh ? packOrmh({ occlusion: merged.occlusion, roughness: merged.roughness, height: merged.height, fallbackRoughness: material.roughness }) : null;
        material.ormh = this.replaceTexture(material.ormh, `${material.name} · ORMH`, packed, 'linear');
        if (merged.albedo)
            vec3.copy(material.averageColor, averageLinearColor(merged.albedo));
        this.onChange();
    }
    renameCustom(id: string, name: string): void {
        const material = this.materials.get(id);
        if (!material || material.source !== 'custom' || !name.trim())
            return;
        material.name = name.trim();
        this.onChange();
    }
    setCustomFoliage(id: string, foliage: TerrainFoliageKind | null): void {
        const material = this.materials.get(id);
        if (!material || material.source !== 'custom' || material.foliage === foliage)
            return;
        material.foliage = foliage;
        this.onChange();
    }
    removeCustom(id: string): void {
        const material = this.materials.get(id);
        if (!material || material.source !== 'custom')
            return;
        this.materials.delete(id);
        this.customSources.delete(id);
        this.onChange();
    }
    private load(material: TerrainMaterial, texture: Texture | null): void {
        if (!texture || !texture.sourcePath)
            return;
        material.pendingMaps++;
        decodeImageFromUri(texture.sourcePath)
            .then((image) => setTextureImage(texture, image))
            .catch((cause: unknown) => {
            console.error(`[terreno] Falha ao carregar "${texture.sourcePath}":`, cause);
        })
            .finally(() => {
            material.pendingMaps--;
            this.onChange();
        });
    }
    private replaceTexture(existing: Texture | null, name: string, image: TextureImage | null, colorSpace: 'srgb' | 'linear'): Texture | null {
        if (!image)
            return null;
        if (existing) {
            setTextureImage(existing, image);
            return existing;
        }
        return createTexture({ name, image, colorSpace });
    }
}
