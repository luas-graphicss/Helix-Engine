import type { ImportFormat } from '@/engine/assets/import/import-types';
import type { AudioAnalysis } from '@/engine/audio/analysis/audio-analysis';
import type { AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import type { EntityKind } from '@/engine/core/scene/entity';
import type { ScriptRunContext } from '@/engine/scripting/script-document';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export type AssetKind = 'model' | 'texture' | 'audio' | 'animation' | 'gui' | 'font' | 'video' | 'vfx' | 'script' | 'prefab';
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
    readonly analysis: AudioAnalysis | null;
    readonly clip: AudioClipSettings;
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
export interface GuiAssetDetails {
    readonly kind: 'gui';
    readonly referenceWidth: number;
    readonly referenceHeight: number;
    readonly elements: number;
    readonly enabled: boolean;
    readonly displayOrder: number;
    readonly fontAssetIds: readonly string[];
    readonly imageAssetIds: readonly string[];
    readonly videoAssetIds?: readonly string[];
}
export interface VideoAssetDetails {
    readonly kind: 'video';
    readonly width: number;
    readonly height: number;
    readonly durationSeconds: number | null;
    readonly hasAudio: boolean | null;
}
export interface FontAssetDetails {
    readonly kind: 'font';
    readonly family: string;
    readonly style: string;
    readonly weight: number;
    readonly italic: boolean;
    readonly container: string;
}
export interface VfxAssetDetails {
    readonly kind: 'vfx';
    readonly emitters: number;
    readonly particleBudget: number;
    readonly durationSeconds: number;
    readonly loop: boolean;
    readonly textureAssetIds: readonly string[];
}
export interface ScriptAssetDetails {
    readonly kind: 'script';
    readonly language: ScriptLanguageId;
    readonly lines: number;
    readonly bytes: number;
    readonly runContext: ScriptRunContext;
    readonly entry: boolean;
    readonly createdAt: number;
}
export interface PrefabAssetDetails {
    readonly kind: 'prefab';
    readonly entities: number;
    readonly triangles: number;
    readonly meshes: number;
    readonly textures: number;
    readonly rootKind: EntityKind;
    readonly components: readonly string[];
}
export type AssetDetails = ModelAssetDetails | TextureAssetDetails | AudioAssetDetails | AnimationAssetDetails | GuiAssetDetails | FontAssetDetails | VideoAssetDetails | VfxAssetDetails | ScriptAssetDetails | PrefabAssetDetails;
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
