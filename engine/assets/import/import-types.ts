import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { getTriangleCount, getVertexCount } from '@/engine/renderer/geometry/mesh-data';
import type { AlphaMode } from '@/engine/core/scene/material';
import type { TextureFilter, TextureWrap } from '@/engine/core/scene/texture';
export type ImportFormat = 'gltf' | 'glb' | 'obj' | 'stl' | 'fbx';
export type ImportUpAxis = 'y' | 'z';
export interface ImportedScene {
    format: ImportFormat;
    name: string;
    sourceFile: string;
    roots: ImportedNode[];
    meshes: ImportedMesh[];
    materials: ImportedMaterial[];
    textures: ImportedTexture[];
    skins: ImportedSkin[];
    animations: ImportedAnimation[];
    upAxis: ImportUpAxis;
    metersPerUnit: number | null;
    warnings: string[];
}
export interface ImportedNode {
    name: string;
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
    meshes: number[];
    children: ImportedNode[];
    nodeIndex?: number;
    skin?: number;
}
export interface ImportedSkin {
    name: string;
    joints: number[];
    inverseBindMatrices: Float32Array;
}
export type ImportedAnimationPath = 'translation' | 'rotation' | 'scale';
export type ImportedInterpolation = 'linear' | 'step' | 'cubic';
export interface ImportedAnimationChannel {
    nodeIndex: number;
    path: ImportedAnimationPath;
    interpolation: ImportedInterpolation;
    times: Float32Array;
    values: Float32Array;
}
export interface ImportedAnimation {
    name: string;
    duration: number;
    channels: ImportedAnimationChannel[];
}
export interface ImportedMesh {
    name: string;
    geometry: MeshData;
    material: number | null;
    hadNormals: boolean;
    hadUvs: boolean;
}
export interface ImportedMaterial {
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
    baseColorMap: number | null;
    metallicRoughnessMap: number | null;
    roughnessMap: number | null;
    metallicMap: number | null;
    normalMap: number | null;
    normalMapMayBeHeight: boolean;
    normalScale: number;
    occlusionMap: number | null;
    occlusionStrength: number;
    emissiveMap: number | null;
}
export interface ImportedTexture {
    name: string;
    sourcePath: string;
    mimeType: string | null;
    data: Blob | null;
    wrapS: TextureWrap;
    wrapT: TextureWrap;
    magFilter: TextureFilter;
    minFilter: TextureFilter;
}
export interface ImportStats {
    nodes: number;
    meshes: number;
    vertices: number;
    triangles: number;
    materials: number;
    textures: number;
    missingTextures: number;
}
export function createImportedNode(name: string): ImportedNode {
    return { name, position: vec3.create(0, 0, 0), rotation: vec3.create(0, 0, 0), scale: vec3.create(1, 1, 1), meshes: [], children: [] };
}
export function createImportedMaterial(name: string, overrides: Partial<ImportedMaterial> = {}): ImportedMaterial {
    return {
        name,
        baseColor: vec3.create(0.8, 0.8, 0.8),
        opacity: 1,
        roughness: 0.6,
        metallic: 0,
        emissive: vec3.create(0, 0, 0),
        emissiveIntensity: 1,
        alphaMode: 'opaque',
        alphaCutoff: 0.5,
        doubleSided: false,
        baseColorMap: null,
        metallicRoughnessMap: null,
        roughnessMap: null,
        metallicMap: null,
        normalMap: null,
        normalMapMayBeHeight: false,
        normalScale: 1,
        occlusionMap: null,
        occlusionStrength: 1,
        emissiveMap: null,
        ...overrides,
    };
}
export function createImportedTexture(name: string, sourcePath: string, data: Blob | null, mimeType: string | null, overrides: Partial<ImportedTexture> = {}): ImportedTexture {
    return { name, sourcePath, mimeType, data, wrapS: 'repeat', wrapT: 'repeat', magFilter: 'linear', minFilter: 'linear', ...overrides };
}
export function computeImportStats(scene: ImportedScene): ImportStats {
    let nodes = 0;
    const visit = (node: ImportedNode) => {
        nodes++;
        node.children.forEach(visit);
    };
    scene.roots.forEach(visit);
    let vertices = 0;
    let triangles = 0;
    for (const mesh of scene.meshes) {
        vertices += getVertexCount(mesh.geometry);
        triangles += getTriangleCount(mesh.geometry);
    }
    return {
        nodes,
        meshes: scene.meshes.length,
        vertices,
        triangles,
        materials: scene.materials.length,
        textures: scene.textures.length,
        missingTextures: scene.textures.filter((texture) => texture.data === null).length,
    };
}
export function baseNameWithoutExtension(path: string): string {
    const file = path.split(/[\\/]/).pop() ?? path;
    const dot = file.lastIndexOf('.');
    return dot > 0 ? file.slice(0, dot) : file;
}
export function fileExtension(path: string): string {
    const file = path.split(/[\\/]/).pop() ?? path;
    const dot = file.lastIndexOf('.');
    return dot >= 0 ? file.slice(dot + 1).toLowerCase() : '';
}
