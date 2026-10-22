import { Box, FileAudio, Image, LayoutGrid, Paintbrush, PersonStanding, Shapes, type LucideIcon } from 'lucide-react';
import type { AssetKind } from '@/engine/assets/library/asset-types';
export type LibraryCategoryId = 'all' | AssetKind | 'material';
export type SceneCategoryId = 'primitives' | 'scene-mesh' | 'scene-texture';
export type AssetCategoryId = LibraryCategoryId | SceneCategoryId;
export interface AssetCategory {
    readonly id: AssetCategoryId;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly tint: string;
}
export const ASSET_KIND_ICON: Record<AssetKind, LucideIcon> = { model: Box, texture: Image, audio: FileAudio, animation: PersonStanding };
export const ASSET_KIND_TINT: Record<AssetKind, string> = { model: 'bg-axis-z', texture: 'bg-axis-x', audio: 'bg-warning', animation: 'bg-primary' };
export const LIBRARY_CATEGORIES: readonly AssetCategory[] = [
    { id: 'all', label: 'Tudo', icon: LayoutGrid, tint: 'bg-muted-foreground' },
    { id: 'model', label: 'Modelos', icon: ASSET_KIND_ICON.model, tint: ASSET_KIND_TINT.model },
    { id: 'animation', label: 'Animações', icon: ASSET_KIND_ICON.animation, tint: ASSET_KIND_TINT.animation },
    { id: 'texture', label: 'Texturas', icon: ASSET_KIND_ICON.texture, tint: ASSET_KIND_TINT.texture },
    { id: 'audio', label: 'Áudio', icon: ASSET_KIND_ICON.audio, tint: ASSET_KIND_TINT.audio },
    { id: 'material', label: 'Materiais', icon: Paintbrush, tint: 'bg-axis-y' },
];
export const SCENE_CATEGORIES: readonly AssetCategory[] = [
    { id: 'primitives', label: 'Primitivas', icon: Shapes, tint: 'bg-primary' },
    { id: 'scene-mesh', label: 'Malhas', icon: Box, tint: ASSET_KIND_TINT.model },
    { id: 'scene-texture', label: 'Texturas', icon: Image, tint: ASSET_KIND_TINT.texture },
];
export function findCategory(id: AssetCategoryId): AssetCategory {
    const category = [...LIBRARY_CATEGORIES, ...SCENE_CATEGORIES].find((candidate) => candidate.id === id);
    if (!category)
        throw new Error(`Categoria desconhecida: ${id}.`);
    return category;
}
export function isLibraryCategory(id: AssetCategoryId): id is LibraryCategoryId {
    return LIBRARY_CATEGORIES.some((category) => category.id === id);
}
