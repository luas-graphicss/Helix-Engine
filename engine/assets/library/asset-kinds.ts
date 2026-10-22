import { IMPORT_FORMATS } from '@/engine/assets/import/import-registry';
import { fileExtension } from '@/engine/assets/import/import-types';
import { ANIMATION_EXTENSION } from '@/engine/core/animation/animation-document';
import type { AssetKind } from './asset-types';
export interface AssetKindInfo {
    readonly kind: AssetKind;
    readonly label: string;
    readonly pluralLabel: string;
    readonly extensions: readonly string[];
}
const TEXTURE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] as const;
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] as const;
export const ANIMATION_EXTENSIONS = [ANIMATION_EXTENSION, 'bvh'] as const;
export const ASSET_KINDS: readonly AssetKindInfo[] = [
    { kind: 'model', label: 'Modelo', pluralLabel: 'Modelos', extensions: IMPORT_FORMATS.flatMap((info) => info.extensions) },
    { kind: 'texture', label: 'Textura', pluralLabel: 'Texturas', extensions: TEXTURE_EXTENSIONS },
    { kind: 'audio', label: 'Áudio', pluralLabel: 'Áudios', extensions: AUDIO_EXTENSIONS },
    { kind: 'animation', label: 'Animação', pluralLabel: 'Animações', extensions: ANIMATION_EXTENSIONS },
];
export function assetKindInfo(kind: AssetKind): AssetKindInfo {
    const info = ASSET_KINDS.find((candidate) => candidate.kind === kind);
    if (!info)
        throw new Error(`Tipo de ativo desconhecido: ${kind}.`);
    return info;
}
export function detectAssetKind(fileName: string): AssetKind | null {
    const extension = fileExtension(fileName);
    return ASSET_KINDS.find((info) => info.extensions.includes(extension))?.kind ?? null;
}
export const LIBRARY_ACCEPT = Array.from(new Set([...ASSET_KINDS.flatMap((info) => info.extensions), ...IMPORT_FORMATS.flatMap((info) => info.companions)].map((extension) => `.${extension}`))).join(',');
export const LIBRARY_FORMAT_SUMMARY = 'modelos (glTF, GLB, OBJ, STL, FBX), animações (.hxanim, BVH ou embutidas em GLB/FBX), imagens e áudio';
