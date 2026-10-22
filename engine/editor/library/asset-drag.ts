import type { LibraryAsset } from '@/engine/assets/library/asset-types';
const ASSET_DRAG_TYPE = 'application/x-helix-asset';
export function setAssetDragData(dataTransfer: DataTransfer, asset: LibraryAsset): void {
    dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
    dataTransfer.setData('text/plain', asset.name);
    dataTransfer.effectAllowed = 'copy';
}
export function carriesAsset(dataTransfer: DataTransfer): boolean {
    return Array.from(dataTransfer.types).includes(ASSET_DRAG_TYPE);
}
export function readAssetDragData(dataTransfer: DataTransfer): string | null {
    return dataTransfer.getData(ASSET_DRAG_TYPE) || null;
}
