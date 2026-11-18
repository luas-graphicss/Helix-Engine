import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { isRecord, type JsonRecord } from '@/engine/mcp/protocol/json-shape';
import { collectFacts } from '../catalog/asset-facts';
import type { AssetDetails, AssetPackage, AssetSearchPage, AssetSearchQuery, AssetSource, AssetVariant, RemoteAsset, RemoteAssetKind, SourceSession, VariantChoice } from '../catalog/asset-source';
import { chooseVariant } from '../catalog/variant-selection';
import { safeFileName } from '../transport/file-naming';
import { httpsUrlAt, listAt, numberAt, recordAt, recordAtPath, recordsAt, textAt } from '../transport/json-reading';
import { requestJson } from '../transport/source-request';
interface Archive {
    readonly url: URL;
    readonly variant: AssetVariant;
}
const API_ORIGIN = 'https://api.sketchfab.com';
const SITE_ORIGIN = 'https://sketchfab.com';
const MODEL_ID_PATTERN = /^[0-9a-f]{32}$/;
const ARCHIVE_FORMAT = 'glb';
const THUMBNAIL_MIN_WIDTH = 256;
const TAG_LIMIT = 12;
const FALLBACK_AUTHOR = 'Unknown author';
function pickThumbnail(model: JsonRecord): URL | null {
    const images = recordsAt(recordAt(model, 'thumbnails') ?? {}, 'images')
        .flatMap((image) => {
            const url = httpsUrlAt(image, 'url');
            return url ? [{ url, width: numberAt(image, 'width') ?? 0 }] : [];
        })
        .sort((left, right) => left.width - right.width);
    return (images.find((image) => image.width >= THUMBNAIL_MIN_WIDTH) ?? images.at(-1))?.url ?? null;
}
function parseModel(value: unknown): RemoteAsset | null {
    if (!isRecord(value))
        return null;
    const id = textAt(value, 'uid');
    if (!MODEL_ID_PATTERN.test(id))
        return null;
    const user = recordAt(value, 'user') ?? {};
    const archive = recordAtPath(value, 'archives', ARCHIVE_FORMAT) ?? {};
    const animations = numberAt(value, 'animationCount');
    return {
        id,
        kind: 'model',
        name: textAt(value, 'name') || id,
        author: textAt(user, 'displayName') || textAt(user, 'username') || FALLBACK_AUTHOR,
        license: textAt(recordAt(value, 'license') ?? {}, 'label') || 'Unknown license',
        pageUrl: httpsUrlAt(value, 'viewerUrl')?.href ?? `${SITE_ORIGIN}/3d-models/${id}`,
        thumbnailUrl: pickThumbnail(value),
        tags: recordsAt(value, 'tags').map((tag) => textAt(tag, 'name')).filter(Boolean).slice(0, TAG_LIMIT),
        facts: collectFacts({
            animated: animations === null ? null : animations > 0,
            animations,
            faces: numberAt(value, 'faceCount'),
            vertices: numberAt(value, 'vertexCount'),
            textures: numberAt(archive, 'textureCount'),
            textureResolution: numberAt(archive, 'textureMaxResolution'),
            bytes: numberAt(archive, 'size'),
        }),
    };
}
function requireModelId(assetId: string): string {
    if (!MODEL_ID_PATTERN.test(assetId))
        throw new ToolFailure(`"${assetId}" is not a Sketchfab model id. Use the "ref" of a search_assets result.`);
    return assetId;
}
async function requestModel(assetId: string): Promise<RemoteAsset> {
    const model = parseModel(await requestJson(new URL(`/v3/models/${requireModelId(assetId)}`, API_ORIGIN)));
    if (!model)
        throw new ToolFailure(`Sketchfab sent an unexpected answer for the model "${assetId}".`);
    return model;
}
async function requestArchive(assetId: string, session: SourceSession): Promise<Archive> {
    const body = await requestJson(new URL(`/v3/models/${requireModelId(assetId)}/download`, API_ORIGIN), { Authorization: `Token ${session.apiKey}` });
    const archive = isRecord(body) ? recordAt(body, ARCHIVE_FORMAT) : null;
    const url = archive ? httpsUrlAt(archive, 'url') : null;
    if (!archive || !url)
        throw new ToolFailure('Sketchfab offers no GLB archive for this model, so the engine cannot import it.');
    return { url, variant: { format: ARCHIVE_FORMAT, quality: null, bytes: numberAt(archive, 'size') } };
}
async function search(query: AssetSearchQuery): Promise<AssetSearchPage> {
    const url = new URL('/v3/search', API_ORIGIN);
    url.searchParams.set('type', 'models');
    url.searchParams.set('downloadable', 'true');
    url.searchParams.set('q', query.text);
    url.searchParams.set('count', String(query.limit));
    if (query.page > 1)
        url.searchParams.set('cursor', String((query.page - 1) * query.limit));
    if (query.animatedOnly)
        url.searchParams.set('animated', 'true');
    if (query.riggedOnly)
        url.searchParams.set('rigged', 'true');
    const body = await requestJson(url);
    if (!isRecord(body))
        throw new ToolFailure('Sketchfab sent an unexpected search answer.');
    return {
        assets: listAt(body, 'results').flatMap((result) => parseModel(result) ?? []),
        hasMore: textAt(recordAt(body, 'cursors') ?? {}, 'next') !== '',
    };
}
async function describe(_kind: RemoteAssetKind, assetId: string, session: SourceSession): Promise<AssetDetails> {
    const [asset, archive] = await Promise.all([requestModel(assetId), requestArchive(assetId, session)]);
    return { asset, variants: [archive.variant] };
}
async function resolvePackage(_kind: RemoteAssetKind, assetId: string, choice: VariantChoice, session: SourceSession): Promise<AssetPackage> {
    const [asset, archive] = await Promise.all([requestModel(assetId), requestArchive(assetId, session)]);
    const variant = chooseVariant([archive.variant], choice, asset.name);
    return { asset, variant, files: [{ url: archive.url, name: safeFileName(asset.name, variant.format), bytes: variant.bytes, slots: [] }] };
}
export const SKETCHFAB: AssetSource = {
    id: 'sketchfab',
    label: 'Sketchfab',
    homepage: SITE_ORIGIN,
    kinds: ['model'],
    licensing: 'Licenses vary per model, mostly Creative Commons. Most require crediting the author and some forbid commercial use.',
    credential: { label: 'Token da API', helpUrl: 'https://sketchfab.com/settings/password' },
    search,
    describe,
    resolvePackage,
};
