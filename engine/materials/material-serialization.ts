import * as vec3 from '@/engine/core/math/vec3';
import type { AlphaMode } from '@/engine/core/scene/material';
import { decodeImage } from '@/engine/assets/image-decoder';
import { clonePipelineSettings, createPipelineSettings, type PipelineSettings } from './map-generation';
import { encodeImageToBlob } from './map-packing';
import { clonePhysicalProperties, createPhysicalProperties, type PhysicalProperties } from './physical-material';
import { createMaterialDocument, MATERIAL_MAP_KINDS, type MaterialDocument, type MaterialMapKind, type MaterialMapSource } from './material-document';
export interface StoredMaterialMap {
    blob: Blob;
    fileName: string;
    mimeType: string | null;
}
export interface StoredMaterialParams {
    baseColor: [
        number,
        number,
        number
    ];
    opacity: number;
    roughness: number;
    metallic: number;
    emissive: [
        number,
        number,
        number
    ];
    emissiveIntensity: number;
    alphaMode: AlphaMode;
    alphaCutoff: number;
    doubleSided: boolean;
    normalScale: number;
    occlusionStrength: number;
    uvTiling: number;
}
export interface StoredMaterial {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    params: StoredMaterialParams;
    pipeline: PipelineSettings;
    physics: PhysicalProperties;
    maps: Partial<Record<MaterialMapKind, StoredMaterialMap>>;
}
export async function serializeMaterialDocument(document: MaterialDocument): Promise<StoredMaterial> {
    const { material } = document;
    const maps: Partial<Record<MaterialMapKind, StoredMaterialMap>> = {};
    for (const { kind } of MATERIAL_MAP_KINDS) {
        const source = document.sources[kind];
        if (!source)
            continue;
        const blob = source.blob ?? (await encodeImageToBlob(source.image));
        maps[kind] = { blob, fileName: source.fileName, mimeType: source.mimeType ?? blob.type ?? null };
    }
    return {
        id: document.id,
        name: document.name,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        params: {
            baseColor: [material.baseColor[0], material.baseColor[1], material.baseColor[2]],
            opacity: material.opacity,
            roughness: material.roughness,
            metallic: material.metallic,
            emissive: [material.emissive[0], material.emissive[1], material.emissive[2]],
            emissiveIntensity: material.emissiveIntensity,
            alphaMode: material.alphaMode,
            alphaCutoff: material.alphaCutoff,
            doubleSided: material.doubleSided,
            normalScale: material.normalScale,
            occlusionStrength: material.occlusionStrength,
            uvTiling: material.uvTiling,
        },
        pipeline: clonePipelineSettings(document.pipeline),
        physics: clonePhysicalProperties(document.physics),
        maps,
    };
}
export async function deserializeMaterialDocument(record: StoredMaterial): Promise<MaterialDocument> {
    const document = createMaterialDocument(record.id, record.name, record.createdAt);
    document.updatedAt = record.updatedAt;
    const { material } = document;
    const params = record.params;
    vec3.set(material.baseColor, ...params.baseColor);
    material.opacity = params.opacity;
    material.roughness = params.roughness;
    material.metallic = params.metallic;
    vec3.set(material.emissive, ...params.emissive);
    material.emissiveIntensity = params.emissiveIntensity;
    material.alphaMode = params.alphaMode;
    material.alphaCutoff = params.alphaCutoff;
    material.doubleSided = params.doubleSided;
    material.normalScale = params.normalScale;
    material.occlusionStrength = params.occlusionStrength;
    material.uvTiling = params.uvTiling;
    document.pipeline = { ...createPipelineSettings(), ...clonePipelineSettings(record.pipeline) };
    document.physics = { ...createPhysicalProperties(), ...record.physics };
    const entries = Object.entries(record.maps) as Array<[
        MaterialMapKind,
        StoredMaterialMap
    ]>;
    const decoded = await Promise.all(entries.map(async ([kind, stored]): Promise<[
        MaterialMapKind,
        MaterialMapSource | null
    ]> => {
        try {
            const image = await decodeImage(stored.blob, stored.mimeType);
            return [kind, { image, fileName: stored.fileName, mimeType: stored.mimeType, blob: stored.blob }];
        }
        catch (cause) {
            console.error(`[materiais] Não foi possível decodificar "${stored.fileName}" de ${record.name}:`, cause);
            return [kind, null];
        }
    }));
    for (const [kind, source] of decoded)
        document.sources[kind] = source;
    return document;
}
