import { formatAssetReference } from './asset-reference';
import type { AssetVariant, RemoteAsset } from './asset-source';
import { requiresAttribution } from './license-label';
const BYTES_PER_MEBIBYTE = 1024 * 1024;
const SIZE_PRECISION = 100;
const TAG_LIMIT = 8;
export function creditLine({ name, author, license, pageUrl }: RemoteAsset): string {
    return `"${name}" by ${author}, ${license}, ${pageUrl}`;
}
export function presentAsset(sourceId: string, asset: RemoteAsset): object {
    return {
        ref: formatAssetReference({ sourceId, kind: asset.kind, assetId: asset.id }),
        name: asset.name,
        author: asset.author,
        license: asset.license,
        creditRequired: requiresAttribution(asset.license),
        tags: asset.tags.slice(0, TAG_LIMIT),
        ...asset.facts,
        page: asset.pageUrl,
        thumbnail: asset.thumbnailUrl?.href,
    };
}
export function presentVariant({ format, quality, bytes }: AssetVariant): object {
    return {
        format,
        quality: quality ?? undefined,
        megabytes: bytes === null ? undefined : Math.round((bytes / BYTES_PER_MEBIBYTE) * SIZE_PRECISION) / SIZE_PRECISION,
    };
}
