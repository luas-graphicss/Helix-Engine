export type GltfAccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';
export interface GltfBuffer {
    uri?: string;
    byteLength: number;
}
export interface GltfBufferView {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
}
export interface GltfSparseIndices {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
}
export interface GltfSparseValues {
    bufferView: number;
    byteOffset?: number;
}
export interface GltfAccessor {
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    normalized?: boolean;
    count: number;
    type: GltfAccessorType;
    sparse?: {
        count: number;
        indices: GltfSparseIndices;
        values: GltfSparseValues;
    };
}
export interface GltfImage {
    uri?: string;
    bufferView?: number;
    mimeType?: string;
    name?: string;
}
export interface GltfSampler {
    magFilter?: number;
    minFilter?: number;
    wrapS?: number;
    wrapT?: number;
}
export interface GltfTexture {
    sampler?: number;
    source?: number;
    name?: string;
    extensions?: {
        EXT_texture_webp?: {
            source: number;
        };
        KHR_texture_basisu?: {
            source: number;
        };
    };
}
export interface GltfTextureInfo {
    index: number;
    texCoord?: number;
    scale?: number;
    strength?: number;
    extensions?: Record<string, unknown>;
}
export interface GltfMaterial {
    name?: string;
    pbrMetallicRoughness?: {
        baseColorFactor?: number[];
        baseColorTexture?: GltfTextureInfo;
        metallicFactor?: number;
        roughnessFactor?: number;
        metallicRoughnessTexture?: GltfTextureInfo;
    };
    normalTexture?: GltfTextureInfo;
    occlusionTexture?: GltfTextureInfo;
    emissiveTexture?: GltfTextureInfo;
    emissiveFactor?: number[];
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
    alphaCutoff?: number;
    doubleSided?: boolean;
    extensions?: {
        KHR_materials_emissive_strength?: {
            emissiveStrength?: number;
        };
        KHR_materials_pbrSpecularGlossiness?: {
            diffuseFactor?: number[];
            diffuseTexture?: GltfTextureInfo;
            glossinessFactor?: number;
        };
        KHR_materials_unlit?: Record<string, never>;
        [key: string]: unknown;
    };
}
export interface GltfPrimitive {
    attributes: Record<string, number>;
    indices?: number;
    material?: number;
    mode?: number;
    extensions?: Record<string, unknown>;
}
export interface GltfMesh {
    name?: string;
    primitives: GltfPrimitive[];
}
export interface GltfNode {
    name?: string;
    children?: number[];
    mesh?: number;
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
}
export interface GltfSceneDef {
    name?: string;
    nodes?: number[];
}
export interface GltfDocument {
    asset: {
        version: string;
        generator?: string;
    };
    extensionsUsed?: string[];
    extensionsRequired?: string[];
    buffers?: GltfBuffer[];
    bufferViews?: GltfBufferView[];
    accessors?: GltfAccessor[];
    images?: GltfImage[];
    samplers?: GltfSampler[];
    textures?: GltfTexture[];
    materials?: GltfMaterial[];
    meshes?: GltfMesh[];
    nodes?: GltfNode[];
    scenes?: GltfSceneDef[];
    scene?: number;
}
