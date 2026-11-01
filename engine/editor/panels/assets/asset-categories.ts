import { Box, Boxes, FileAudio, FileCode2, Film, Image, LayoutGrid, LayoutTemplate, Paintbrush, PersonStanding, Shapes, Sparkles, Type, type LucideIcon } from 'lucide-react';
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
export const ASSET_KIND_ICON: Record<AssetKind, LucideIcon> = { model: Box, texture: Image, audio: FileAudio, animation: PersonStanding, gui: LayoutTemplate, font: Type, video: Film, vfx: Sparkles, script: FileCode2, prefab: Boxes };
export const ASSET_KIND_TINT: Record<AssetKind, string> = { model: 'bg-axis-z', texture: 'bg-axis-x', audio: 'bg-warning', animation: 'bg-primary', gui: 'bg-accent', font: 'bg-foreground', video: 'bg-destructive', vfx: 'bg-selection', script: 'bg-csg-union', prefab: 'bg-csg-intersect' };
export const LIBRARY_CATEGORIES: readonly AssetCategory[] = [
    { id: 'all', label: 'Tudo', icon: LayoutGrid, tint: 'bg-muted-foreground' },
    { id: 'model', label: 'Modelos', icon: ASSET_KIND_ICON.model, tint: ASSET_KIND_TINT.model },
    { id: 'prefab', label: 'Prefabs', icon: ASSET_KIND_ICON.prefab, tint: ASSET_KIND_TINT.prefab },
    { id: 'animation', label: 'Animações', icon: ASSET_KIND_ICON.animation, tint: ASSET_KIND_TINT.animation },
    { id: 'texture', label: 'Texturas', icon: ASSET_KIND_ICON.texture, tint: ASSET_KIND_TINT.texture },
    { id: 'audio', label: 'Áudio', icon: ASSET_KIND_ICON.audio, tint: ASSET_KIND_TINT.audio },
    { id: 'video', label: 'Vídeos', icon: ASSET_KIND_ICON.video, tint: ASSET_KIND_TINT.video },
    { id: 'gui', label: 'Telas', icon: ASSET_KIND_ICON.gui, tint: ASSET_KIND_TINT.gui },
    { id: 'vfx', label: 'Efeitos', icon: ASSET_KIND_ICON.vfx, tint: ASSET_KIND_TINT.vfx },
    { id: 'script', label: 'Scripts', icon: ASSET_KIND_ICON.script, tint: ASSET_KIND_TINT.script },
    { id: 'font', label: 'Fontes', icon: ASSET_KIND_ICON.font, tint: ASSET_KIND_TINT.font },
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
