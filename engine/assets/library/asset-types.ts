import type { ImportFormat } from '@/engine/assets/import/import-types';
export type AssetKind = 'model' | 'texture' | 'audio' | 'animation';
export interface ModelRigDetails {
    readonly jointCount: number;
    readonly roles: readonly string[];
    readonly rootBone: string;
}
export interface AssetFileEntry {
    readonly path: string;
    readonly mimeType: string;
    readonly size: number;
}
export interface ModelAssetDetails {
    readonly kind: 'model';
    readonly format: ImportFormat;
    readonly nodes: number;
    readonly meshes: number;
    readonly vertices: number;
    readonly triangles: number;
    readonly materials: number;
    readonly textures: number;
    readonly missingTextures: number;
    readonly dimensions: readonly [
        number,
        number,
        number
    ] | null;
    readonly rig: ModelRigDetails | null;
    readonly animations: readonly string[];
}
export interface TextureAssetDetails {
    readonly kind: 'texture';
    readonly width: number;
    readonly height: number;
}
export interface AudioAssetDetails {
    readonly kind: 'audio';
    readonly durationSeconds: number | null;
}
export interface AnimationAssetDetails {
    readonly kind: 'animation';
    readonly durationSeconds: number;
    readonly loop: boolean;
    readonly frameRate: number | null;
    readonly tracks: number;
    readonly keyframes: number;
    readonly joints: number;
    readonly jointNames: readonly string[];
    readonly hasSkeleton: boolean;
    readonly events: number;
    readonly sourceFormat: string | null;
}
export type AssetDetails = ModelAssetDetails | TextureAssetDetails | AudioAssetDetails | AnimationAssetDetails;
export interface AssetThumbnail {
    readonly blob: Blob;
    readonly custom: boolean;
}
export interface LibraryAsset {
    readonly id: string;
    readonly kind: AssetKind;
    name: string;
    readonly primaryPath: string;
    readonly files: readonly AssetFileEntry[];
    readonly format: string;
    readonly size: number;
    readonly contentHash: string;
    tags: string[];
    readonly createdAt: number;
    updatedAt: number;
    details: AssetDetails;
    thumbnail: AssetThumbnail | null;
}
export interface AssetSnapshot {
    readonly asset: LibraryAsset;
    readonly files: readonly File[];
}
export function primaryFileOf(snapshot: AssetSnapshot): File {
    const file = snapshot.files.find((candidate) => candidate.name === snapshot.asset.primaryPath);
    if (!file)
        throw new Error(`Arquivo principal "${snapshot.asset.primaryPath}" ausente em ${snapshot.asset.name}.`);
    return file;
}
