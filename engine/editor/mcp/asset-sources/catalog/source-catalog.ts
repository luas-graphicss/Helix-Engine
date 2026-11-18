import { FREESOUND } from '../providers/freesound';
import { OPENVERSE } from '../providers/openverse';
import { POLY_HAVEN } from '../providers/poly-haven/poly-haven-source';
import { SKETCHFAB } from '../providers/sketchfab';
import type { AssetSource } from './asset-source';
export const ASSET_SOURCES: readonly AssetSource[] = [POLY_HAVEN, SKETCHFAB, FREESOUND, OPENVERSE];
export function findAssetSource(sourceId: string): AssetSource | undefined {
    return ASSET_SOURCES.find((source) => source.id === sourceId);
}
