import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { copyMaterial, createMaterial, type Material } from '@/engine/core/scene/material';
import { createTexture, setTextureImage, type Texture, type TextureColorSpace, type TextureImage } from '@/engine/core/scene/texture';
import { clonePipelineSettings, createPipelineSettings, emptyGeneratedMaps, type GeneratedMaps, type PipelineSettings } from './map-generation';
import { averageLinearColor, packOrm } from './map-packing';
import { clonePhysicalProperties, createPhysicalProperties, type PhysicalProperties } from './physical-material';
export type MaterialMapKind = 'albedo' | 'normal' | 'roughness' | 'metallic' | 'occlusion' | 'height' | 'emissive';
export type GeneratedMapKind = keyof GeneratedMaps;
export interface MaterialMapInfo {
    readonly kind: MaterialMapKind;
    readonly label: string;
    readonly colorSpace: TextureColorSpace;
    readonly hint: string;
    readonly derivable: boolean;
}
export const MATERIAL_MAP_KINDS: readonly MaterialMapInfo[] = [
    { kind: 'albedo', label: 'Albedo', colorSpace: 'srgb', hint: 'Cor base (sRGB). Único mapa obrigatório para o pipeline.', derivable: false },
    { kind: 'normal', label: 'Normal', colorSpace: 'linear', hint: 'Relevo em espaço tangente, convenção OpenGL (verde para cima).', derivable: true },
    { kind: 'roughness', label: 'Rugosidade', colorSpace: 'linear', hint: 'Escala de cinza: branco é fosco, preto é espelhado.', derivable: true },
    { kind: 'metallic', label: 'Metálico', colorSpace: 'linear', hint: 'Escala de cinza: branco é metal, preto é dielétrico.', derivable: false },
    { kind: 'occlusion', label: 'Oclusão', colorSpace: 'linear', hint: 'Escala de cinza: escurece fendas e cantos.', derivable: true },
    { kind: 'height', label: 'Altura', colorSpace: 'linear', hint: 'Deslocamento: guia a mistura entre camadas no terreno.', derivable: true },
    { kind: 'emissive', label: 'Emissivo', colorSpace: 'srgb', hint: 'Cor emitida (sRGB), multiplicada pela intensidade.', derivable: false },
];
export const GENERATED_MAP_KINDS: readonly GeneratedMapKind[] = ['height', 'normal', 'roughness', 'occlusion'];
export function isGeneratedMapKind(kind: MaterialMapKind): kind is GeneratedMapKind {
    return (GENERATED_MAP_KINDS as readonly string[]).includes(kind);
}
export interface MaterialMapSource {
    readonly image: TextureImage;
    readonly fileName: string;
    readonly mimeType: string | null;
    readonly blob: Blob | null;
}
export type MaterialSources = Record<MaterialMapKind, MaterialMapSource | null>;
export interface MaterialDocument {
    readonly id: string;
    name: string;
    readonly createdAt: number;
    updatedAt: number;
    readonly sources: MaterialSources;
    generated: GeneratedMaps;
    pipeline: PipelineSettings;
    physics: PhysicalProperties;
    readonly material: Material;
    readonly textures: {
        readonly baseColor: Texture;
        readonly normal: Texture;
        readonly orm: Texture;
        readonly emissive: Texture;
    };
    averageColor: Vec3 | null;
    generating: boolean;
    version: number;
}
export function emptySources(): MaterialSources {
    return { albedo: null, normal: null, roughness: null, metallic: null, occlusion: null, height: null, emissive: null };
}
export function createMaterialDocument(id: string, name: string, createdAt = Date.now()): MaterialDocument {
    const material = createMaterial({ name, libraryId: id });
    return {
        id,
        name,
        createdAt,
        updatedAt: createdAt,
        sources: emptySources(),
        generated: emptyGeneratedMaps(),
        pipeline: createPipelineSettings(),
        physics: createPhysicalProperties(),
        material,
        textures: {
            baseColor: createTexture({ name: `${name} · Albedo`, colorSpace: 'srgb' }),
            normal: createTexture({ name: `${name} · Normal`, colorSpace: 'linear' }),
            orm: createTexture({ name: `${name} · ORM`, colorSpace: 'linear' }),
            emissive: createTexture({ name: `${name} · Emissivo`, colorSpace: 'srgb' }),
        },
        averageColor: null,
        generating: false,
        version: 0,
    };
}
export function resolveMap(document: MaterialDocument, kind: MaterialMapKind): TextureImage | null {
    const source = document.sources[kind];
    if (source)
        return source.image;
    return isGeneratedMapKind(kind) ? document.generated[kind] : null;
}
export function mapOrigin(document: MaterialDocument, kind: MaterialMapKind): 'source' | 'generated' | 'none' {
    if (document.sources[kind])
        return 'source';
    if (isGeneratedMapKind(kind) && document.generated[kind])
        return 'generated';
    return 'none';
}
export function hasAnySource(document: MaterialDocument): boolean {
    return MATERIAL_MAP_KINDS.some(({ kind }) => document.sources[kind] !== null);
}
function bindTexture(texture: Texture, image: TextureImage | null): Texture | null {
    if (texture.image !== image)
        setTextureImage(texture, image);
    return image ? texture : null;
}
export function syncMaterialDocument(document: MaterialDocument): void {
    const { material, textures } = document;
    const albedo = resolveMap(document, 'albedo');
    material.baseColorMap = bindTexture(textures.baseColor, albedo);
    material.normalMap = bindTexture(textures.normal, resolveMap(document, 'normal'));
    material.emissiveMap = bindTexture(textures.emissive, resolveMap(document, 'emissive'));
    const occlusion = resolveMap(document, 'occlusion');
    const roughness = resolveMap(document, 'roughness');
    const metallic = resolveMap(document, 'metallic');
    const orm = packOrm({ occlusion, roughness, metallic });
    const ormTexture = bindTexture(textures.orm, orm);
    material.metallicRoughnessMap = roughness || metallic ? ormTexture : null;
    material.occlusionMap = occlusion ? ormTexture : null;
    document.averageColor = albedo ? vec3.create(...averageLinearColor(albedo)) : null;
    material.name = document.name;
    document.version++;
}
export function resetMaterialDocument(document: MaterialDocument): void {
    const defaults = createMaterial({ name: document.name, libraryId: document.id });
    copyMaterial(document.material, defaults);
    document.pipeline = createPipelineSettings();
    document.physics = createPhysicalProperties();
}
export function copyDocumentSettings(target: MaterialDocument, source: MaterialDocument): void {
    copyMaterial(target.material, source.material);
    target.material.name = target.name;
    target.pipeline = clonePipelineSettings(source.pipeline);
    target.physics = clonePhysicalProperties(source.physics);
}
export function renameMaterialDocument(document: MaterialDocument, name: string): void {
    document.name = name;
    document.material.name = name;
    document.textures.baseColor.name = `${name} · Albedo`;
    document.textures.normal.name = `${name} · Normal`;
    document.textures.orm.name = `${name} · ORM`;
    document.textures.emissive.name = `${name} · Emissivo`;
}
