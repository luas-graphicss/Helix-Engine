import type { Material } from '@/engine/core/scene/material';
import type { Texture } from '@/engine/core/scene/texture';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
export function isMaterial(value: unknown): value is Material {
    const candidate = value as Material;
    return typeof candidate === 'object' && candidate !== null && candidate.baseColor instanceof Float32Array && typeof candidate.roughness === 'number' && 'alphaMode' in candidate;
}
export function isMeshData(value: unknown): value is MeshData {
    const candidate = value as MeshData;
    return typeof candidate === 'object' && candidate !== null && candidate.positions instanceof Float32Array && ArrayBuffer.isView(candidate.indices) && typeof candidate.name === 'string';
}
export function isTexture(value: unknown): value is Texture {
    const candidate = value as Texture;
    return typeof candidate === 'object' && candidate !== null && typeof candidate.id === 'number' && 'colorSpace' in candidate && 'version' in candidate;
}
export function isEngineResource(value: unknown): boolean {
    return isMaterial(value) || isMeshData(value) || isTexture(value);
}
