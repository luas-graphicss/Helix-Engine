import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { isRecord } from '@/engine/mcp/protocol/json-shape';
import { collectFacts } from '../catalog/asset-facts';
import type { AssetDetails, AssetPackage, AssetSearchPage, AssetSearchQuery, AssetSource, AssetVariant, RemoteAsset, RemoteAssetKind, VariantChoice } from '../catalog/asset-source';
import { licenseLabelFromCode } from '../catalog/license-label';
import { chooseVariant } from '../catalog/variant-selection';
import { fileExtensionOf, lastPathSegment, safeFileName } from '../transport/file-naming';
import { httpsUrlAt, listAt, numberAt, recordsAt, textAt } from '../transport/json-reading';
import { requestJson } from '../transport/source-request';
type OpenverseKind = 'image' | 'audio';
interface Media {
    readonly asset: RemoteAsset;
    readonly fileUrl: URL | null;
    readonly variants: readonly AssetVariant[];
}
const API_ORIGIN = 'https://api.openverse.org';
const SITE_ORIGIN = 'https://openverse.org';
const MEDIA_ID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const COLLECTION: Record<OpenverseKind, string> = { image: 'images', audio: 'audio' };
const MILLISECONDS_PER_SECOND = 1000;
const TAG_LIMIT = 12;
const FALLBACK_NAME = 'Untitled';
const FALLBACK_AUTHOR = 'Unknown author';
function requireOpenverseKind(kind: RemoteAssetKind): OpenverseKind {
    if (kind !== 'image' && kind !== 'audio')
        throw new ToolFailure(`Openverse has no ${kind} assets. It offers image and audio.`);
    return kind;
}
function describeSize(width: number | null, height: number | null): string | null {
    return width !== null && height !== null ? `${width}x${height}` : null;
}
function parseMedia(kind: OpenverseKind, value: unknown): Media | null {
    if (!isRecord(value))
        return null;
    const id = textAt(value, 'id');
    if (!MEDIA_ID_PATTERN.test(id))
        return null;
    const fileUrl = httpsUrlAt(value, 'url');
    const format = (textAt(value, 'filetype') || (fileUrl ? fileExtensionOf(lastPathSegment(fileUrl)) : '')).toLowerCase();
    const size = describeSize(numberAt(value, 'width'), numberAt(value, 'height'));
    const duration = numberAt(value, 'duration');
    const asset: RemoteAsset = {
        id,
        kind,
        name: textAt(value, 'title') || FALLBACK_NAME,
        author: textAt(value, 'creator') || FALLBACK_AUTHOR,
        license: licenseLabelFromCode(textAt(value, 'license'), textAt(value, 'license_version')),
        pageUrl: httpsUrlAt(value, 'foreign_landing_url')?.href ?? `${SITE_ORIGIN}/${kind}/${id}`,
        thumbnailUrl: httpsUrlAt(value, 'thumbnail'),
        tags: recordsAt(value, 'tags').map((tag) => textAt(tag, 'name')).filter(Boolean).slice(0, TAG_LIMIT),
        facts: collectFacts({ size, durationSeconds: duration === null ? null : Math.round(duration / MILLISECONDS_PER_SECOND), format, collection: textAt(value, 'source') }),
    };
    const variants = fileUrl && format ? [{ format, quality: kind === 'image' ? size : null, bytes: numberAt(value, 'filesize') }] : [];
    return { asset, fileUrl, variants };
}
async function requestMedia(kind: OpenverseKind, assetId: string): Promise<Media> {
    if (!MEDIA_ID_PATTERN.test(assetId))
        throw new ToolFailure(`"${assetId}" is not an Openverse id. Use the "ref" of a search_assets result.`);
    const media = parseMedia(kind, await requestJson(new URL(`/v1/${COLLECTION[kind]}/${assetId}/`, API_ORIGIN)));
    if (!media)
        throw new ToolFailure(`Openverse sent an unexpected answer for "${assetId}".`);
    return media;
}
async function search(query: AssetSearchQuery): Promise<AssetSearchPage> {
    const kind = requireOpenverseKind(query.kind);
    const url = new URL(`/v1/${COLLECTION[kind]}/`, API_ORIGIN);
    url.searchParams.set('q', query.text);
    url.searchParams.set('page', String(query.page));
    url.searchParams.set('page_size', String(query.limit));
    const body = await requestJson(url);
    if (!isRecord(body))
        throw new ToolFailure('Openverse sent an unexpected search answer.');
    return {
        assets: listAt(body, 'results').flatMap((result) => parseMedia(kind, result)?.asset ?? []),
        hasMore: (numberAt(body, 'page') ?? 1) < (numberAt(body, 'page_count') ?? 1),
    };
}
async function describe(kind: RemoteAssetKind, assetId: string): Promise<AssetDetails> {
    const { asset, variants } = await requestMedia(requireOpenverseKind(kind), assetId);
    return { asset, variants };
}
async function resolvePackage(kind: RemoteAssetKind, assetId: string, choice: VariantChoice): Promise<AssetPackage> {
    const { asset, fileUrl, variants } = await requestMedia(requireOpenverseKind(kind), assetId);
    const variant = chooseVariant(variants, choice, asset.name);
    if (!fileUrl)
        throw new ToolFailure(`Openverse lists no downloadable file for "${asset.name}".`);
    return { asset, variant, files: [{ url: fileUrl, name: safeFileName(asset.name, variant.format), bytes: variant.bytes, slots: [] }] };
}
export const OPENVERSE: AssetSource = {
    id: 'openverse',
    label: 'Openverse',
    homepage: SITE_ORIGIN,
    kinds: ['image', 'audio'],
    licensing: 'Openly licensed media gathered from many collections. Each result names its license and most require crediting the author.',
    credential: null,
    search,
    describe,
    resolvePackage,
};
