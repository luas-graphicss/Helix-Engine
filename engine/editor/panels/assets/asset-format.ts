import { formatLabel } from '@/engine/assets/import/import-registry';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { formatBytes, formatInteger, formatMeters } from '@/engine/editor/import/dialog/import-format';
export function formatDuration(seconds: number | null): string {
    if (seconds === null)
        return 'Duração desconhecida';
    const whole = Math.round(seconds);
    const minutes = Math.floor(whole / 60);
    return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
export function formatDimensions(dimensions: readonly [
    number,
    number,
    number
]): string {
    return dimensions.map((value) => formatMeters(value).replace(/\s/g, '\u00a0')).join(' × ');
}
export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
export function formatBadge(asset: LibraryAsset): string {
    return asset.format.toUpperCase();
}
export function describeLibraryAsset(asset: LibraryAsset): string {
    const { details } = asset;
    switch (details.kind) {
        case 'model':
            return `${formatInteger(details.triangles)} tris · ${details.meshes} ${details.meshes === 1 ? 'malha' : 'malhas'}`;
        case 'texture':
            return `${details.width}×${details.height} · ${formatBytes(asset.size)}`;
        case 'audio':
            return `${formatDuration(details.durationSeconds)} · ${formatBytes(asset.size)}`;
        case 'animation':
            return `${formatClipDuration(details.durationSeconds)} · ${details.joints} ${details.joints === 1 ? 'osso' : 'ossos'}`;
    }
}
export function formatClipDuration(seconds: number): string {
    if (seconds >= 60)
        return formatDuration(seconds);
    return `${seconds.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} s`;
}
export function describeFormat(asset: LibraryAsset): string {
    if (asset.details.kind === 'model')
        return formatLabel(asset.details.format);
    if (asset.details.kind === 'animation')
        return 'Helix Animation';
    return asset.format.toUpperCase();
}
