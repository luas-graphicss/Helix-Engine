import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Texture } from './texture';
export type AlphaMode = 'opaque' | 'mask' | 'blend';
export type MaterialTextureSlot = 'baseColorMap' | 'metallicRoughnessMap' | 'normalMap' | 'occlusionMap' | 'emissiveMap';
export interface Material {
    name: string;
    baseColor: Vec3;
    opacity: number;
    roughness: number;
    metallic: number;
    emissive: Vec3;
    emissiveIntensity: number;
    alphaMode: AlphaMode;
    alphaCutoff: number;
    doubleSided: boolean;
    baseColorMap: Texture | null;
    metallicRoughnessMap: Texture | null;
    normalMap: Texture | null;
    normalScale: number;
    occlusionMap: Texture | null;
    occlusionStrength: number;
    emissiveMap: Texture | null;
}
export type MaterialOptions = Partial<Material>;
export const MATERIAL_TEXTURE_SLOTS: ReadonlyArray<{
    slot: MaterialTextureSlot;
    label: string;
    colorSpace: 'srgb' | 'linear';
}> = [
    { slot: 'baseColorMap', label: 'Cor base', colorSpace: 'srgb' },
    { slot: 'normalMap', label: 'Normal', colorSpace: 'linear' },
    { slot: 'metallicRoughnessMap', label: 'Metálico/Rugosidade', colorSpace: 'linear' },
    { slot: 'occlusionMap', label: 'Oclusão', colorSpace: 'linear' },
    { slot: 'emissiveMap', label: 'Emissivo', colorSpace: 'srgb' },
];
export function createMaterial(options: MaterialOptions = {}): Material {
    return {
        name: options.name ?? 'Material',
        baseColor: options.baseColor ?? vec3.create(0.8, 0.8, 0.8),
        opacity: options.opacity ?? 1,
        roughness: options.roughness ?? 0.6,
        metallic: options.metallic ?? 0,
        emissive: options.emissive ?? vec3.create(0, 0, 0),
        emissiveIntensity: options.emissiveIntensity ?? 1,
        alphaMode: options.alphaMode ?? 'opaque',
        alphaCutoff: options.alphaCutoff ?? 0.5,
        doubleSided: options.doubleSided ?? false,
        baseColorMap: options.baseColorMap ?? null,
        metallicRoughnessMap: options.metallicRoughnessMap ?? null,
        normalMap: options.normalMap ?? null,
        normalScale: options.normalScale ?? 1,
        occlusionMap: options.occlusionMap ?? null,
        occlusionStrength: options.occlusionStrength ?? 1,
        emissiveMap: options.emissiveMap ?? null,
    };
}
export function cloneMaterial(material: Material): Material {
    return {
        ...material,
        baseColor: vec3.copy(vec3.create(), material.baseColor),
        emissive: vec3.copy(vec3.create(), material.emissive),
    };
}
export function hasAnyTexture(material: Material): boolean {
    return MATERIAL_TEXTURE_SLOTS.some(({ slot }) => material[slot] !== null);
}
