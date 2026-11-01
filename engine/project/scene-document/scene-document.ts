import type { EntityKind } from '@/engine/core/scene/entity';
import type { MaterialTextureSlot } from '@/engine/core/scene/material';
import type { TextureColorSpace, TextureFilter, TextureWrap } from '@/engine/core/scene/texture';
import type { BinaryRef } from './binary-table';
import type { PlainValue } from './plain-data';
export const SCENE_DOCUMENT_FORMAT = 'helix-scene';
export const SCENE_DOCUMENT_VERSION = 1;
export interface MeshJson {
    name: string;
    positions: BinaryRef;
    normals: BinaryRef;
    uvs: BinaryRef;
    indices: BinaryRef;
    skinning?: {
        joints: BinaryRef;
        weights: BinaryRef;
    };
}
export interface TextureJson {
    name: string;
    image: number | null;
    width: number;
    height: number;
    colorSpace: TextureColorSpace;
    wrapS: TextureWrap;
    wrapT: TextureWrap;
    magFilter: TextureFilter;
    minFilter: TextureFilter;
    sourcePath: string;
    mimeType: string | null;
}
export interface MaterialJson {
    library: string | null;
    values: PlainValue;
    maps: Partial<Record<MaterialTextureSlot, number>>;
}
export type TerrainLayerMaterialRef = {
    catalog: string;
} | {
    library: string;
};
export interface TerrainLayerJson {
    material: TerrainLayerMaterialRef;
    name: string;
    tiling: number;
    tint: number[];
    normalStrength: number;
    roughness: number;
    auto: PlainValue;
}
export interface TerrainJson {
    size: number;
    resolution: number;
    heights: BinaryRef;
    splatResolution: number;
    splat: [
        BinaryRef,
        BinaryRef
    ];
    grassResolution: number;
    grassMap: BinaryRef;
    layers: TerrainLayerJson[];
    shading: PlainValue;
    grass: PlainValue;
    water: PlainValue;
}
export interface SkinJson {
    joints: number[];
    inverseBindMatrices: BinaryRef;
    restBounds: number[];
}
export interface RigJson {
    name: string;
    joints: number[];
    inverseBindMatrices: BinaryRef;
    bindPositions: BinaryRef;
    bindRotations: BinaryRef;
    bindScales: BinaryRef;
    unitScale: number;
}
export interface EntityJson {
    id: number;
    name: string;
    kind: EntityKind;
    position: number[];
    rotation: number[];
    scale: number[];
    visible: boolean;
    locked: boolean;
    castShadows: boolean;
    receiveShadows: boolean;
    mesh?: number;
    material?: number;
    light?: PlainValue;
    terrain?: TerrainJson;
    rigidBody?: PlainValue;
    character?: PlainValue;
    skin?: SkinJson;
    rig?: RigJson;
    csg?: {
        sourceMesh: number;
        settings: PlainValue;
    };
    csgBrush?: PlainValue;
    audioSource?: PlainValue;
    audioZone?: PlainValue;
    guiSurface?: PlainValue;
    vfx?: PlainValue;
    script?: PlainValue;
    tags?: string[];
    meta?: Record<string, PlainValue>;
    children: EntityJson[];
}
export interface SceneResourcesJson {
    meshes: MeshJson[];
    textures: TextureJson[];
    materials: MaterialJson[];
}
export interface SceneResourcesDocument {
    json: SceneResourcesJson;
    binary: ArrayBuffer;
    images: Blob[];
}
export interface SceneJson extends SceneResourcesJson {
    format: typeof SCENE_DOCUMENT_FORMAT;
    version: number;
    savedAt: number;
    name: string;
    nextEntityId: number;
    environment: {
        sky: PlainValue;
        postProcessing: PlainValue;
        physics: PlainValue;
        player: PlainValue;
        audio: PlainValue;
        scripting?: PlainValue;
    };
    root: EntityJson;
    stats: {
        entities: number;
    };
}
export interface SceneDocument {
    json: SceneJson;
    binary: ArrayBuffer;
    images: Blob[];
}
export function isSceneJson(value: unknown): value is SceneJson {
    return typeof value === 'object' && value !== null && (value as SceneJson).format === SCENE_DOCUMENT_FORMAT && typeof (value as SceneJson).version === 'number';
}
