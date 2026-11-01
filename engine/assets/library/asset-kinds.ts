import { IMPORT_FORMATS } from '@/engine/assets/import/import-registry';
import { fileExtension } from '@/engine/assets/import/import-types';
import { AUDIO_EXTENSIONS, AUDIO_FORMAT_SUMMARY } from '@/engine/audio/core/audio-formats';
import { ANIMATION_EXTENSION } from '@/engine/core/animation/animation-document';
import { GUI_EXTENSION } from '@/engine/gui/document/gui-document';
import { PREFAB_EXTENSION } from '@/engine/project/prefab/prefab-document';
import { SCRIPT_EXTENSIONS } from '@/engine/scripting/script-languages';
import { VFX_EXTENSION } from '@/engine/vfx/document/vfx-document';
import type { AssetKind } from './asset-types';
export interface AssetKindInfo {
    readonly kind: AssetKind;
    readonly label: string;
    readonly pluralLabel: string;
    readonly extensions: readonly string[];
}
const TEXTURE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] as const;
export const ANIMATION_EXTENSIONS = [ANIMATION_EXTENSION, 'bvh'] as const;
export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v', 'mov', 'ogv'] as const;
export const ASSET_KINDS: readonly AssetKindInfo[] = [
    { kind: 'model', label: 'Modelo', pluralLabel: 'Modelos', extensions: IMPORT_FORMATS.flatMap((info) => info.extensions) },
    { kind: 'texture', label: 'Textura', pluralLabel: 'Texturas', extensions: TEXTURE_EXTENSIONS },
    { kind: 'audio', label: 'Áudio', pluralLabel: 'Áudios', extensions: AUDIO_EXTENSIONS },
    { kind: 'animation', label: 'Animação', pluralLabel: 'Animações', extensions: ANIMATION_EXTENSIONS },
    { kind: 'gui', label: 'Tela', pluralLabel: 'Telas', extensions: [GUI_EXTENSION] },
    { kind: 'font', label: 'Fonte', pluralLabel: 'Fontes', extensions: FONT_EXTENSIONS },
    { kind: 'video', label: 'Vídeo', pluralLabel: 'Vídeos', extensions: VIDEO_EXTENSIONS },
    { kind: 'vfx', label: 'Efeito', pluralLabel: 'Efeitos', extensions: [VFX_EXTENSION] },
    { kind: 'script', label: 'Script', pluralLabel: 'Scripts', extensions: SCRIPT_EXTENSIONS },
    { kind: 'prefab', label: 'Prefab', pluralLabel: 'Prefabs', extensions: [PREFAB_EXTENSION] },
];
export function assetKindInfo(kind: AssetKind): AssetKindInfo {
    const info = ASSET_KINDS.find((candidate) => candidate.kind === kind);
    if (!info)
        throw new Error(`Tipo de ativo desconhecido: ${kind}.`);
    return info;
}
export function assetKindAccept(kind: AssetKind): string {
    return assetKindInfo(kind)
        .extensions.map((extension) => `.${extension}`)
        .join(',');
}
export const VIDEO_ACCEPT = assetKindAccept('video');
export const FONT_ACCEPT = assetKindAccept('font');
export function detectAssetKind(fileName: string): AssetKind | null {
    const extension = fileExtension(fileName);
    return ASSET_KINDS.find((info) => info.extensions.includes(extension))?.kind ?? null;
}
export const LIBRARY_ACCEPT = Array.from(new Set([...ASSET_KINDS.flatMap((info) => info.extensions), ...IMPORT_FORMATS.flatMap((info) => info.companions)].map((extension) => `.${extension}`))).join(',');
export const LIBRARY_FORMAT_SUMMARY = `modelos (glTF, GLB, OBJ, STL, FBX), animações (.hxanim, BVH ou embutidas em GLB/FBX), imagens, áudio (${AUDIO_FORMAT_SUMMARY}), vídeos (MP4, WebM, MOV), telas (.hxgui), efeitos (.hxvfx), prefabs (.hxprefab), scripts (Luau, Lua, JS, TS, C++ e outros) e fontes (TTF, OTF, WOFF)`;
