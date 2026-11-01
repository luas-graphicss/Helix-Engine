import { formatLabel } from '@/engine/assets/import/import-registry';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { formatBytes, formatInteger, formatMeters } from '@/engine/editor/import/dialog/import-format';
import { scriptLanguage } from '@/engine/scripting/script-languages';
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
const FONT_CONTAINER_LABEL: Record<string, string> = { ttf: 'TrueType', otf: 'OpenType', woff: 'WOFF', woff2: 'WOFF2' };
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
        case 'gui':
            return `${details.referenceWidth}×${details.referenceHeight} · ${details.elements} ${details.elements === 1 ? 'elemento' : 'elementos'}`;
        case 'font':
            return `${details.style} · ${formatBytes(asset.size)}`;
        case 'video':
            return `${details.width > 0 ? `${details.width}×${details.height} · ` : ''}${formatDuration(details.durationSeconds)} · ${formatBytes(asset.size)}`;
        case 'vfx':
            return `${details.emitters} ${details.emitters === 1 ? 'emissor' : 'emissores'} · ${formatInteger(details.particleBudget)} partículas · ${details.loop ? 'laço' : formatClipDuration(details.durationSeconds)}`;
        case 'script':
            return `${scriptLanguage(details.language).label} · ${formatInteger(details.lines)} ${details.lines === 1 ? 'linha' : 'linhas'}${details.entry ? ' · entrada' : ''}`;
        case 'prefab':
            return `${details.entities} ${details.entities === 1 ? 'ator' : 'atores'} · ${formatInteger(details.triangles)} tris · ${formatBytes(asset.size)}`;
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
    if (asset.details.kind === 'gui')
        return 'Helix GUI';
    if (asset.details.kind === 'vfx')
        return 'Helix VFX';
    if (asset.details.kind === 'prefab')
        return 'Helix Prefab';
    if (asset.details.kind === 'script')
        return scriptLanguage(asset.details.language).label;
    if (asset.details.kind === 'font')
        return FONT_CONTAINER_LABEL[asset.details.container] ?? asset.format.toUpperCase();
    return asset.format.toUpperCase();
}
