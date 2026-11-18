import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { isRecord, type JsonRecord } from '@/engine/mcp/protocol/json-shape';
import { collectFacts } from '../catalog/asset-facts';
import type { AssetDetails, AssetPackage, AssetSearchPage, AssetSearchQuery, AssetSource, AssetVariant, RemoteAsset, RemoteAssetKind, SourceSession, VariantChoice } from '../catalog/asset-source';
import { licenseLabelFromUrl } from '../catalog/license-label';
import { chooseVariant } from '../catalog/variant-selection';
import { safeFileName } from '../transport/file-naming';
import { httpsUrlAt, listAt, numberAt, recordAt, textAt, textsAt } from '../transport/json-reading';
import { requestJson, type RequestHeaders } from '../transport/source-request';
interface Preview {
    readonly key: string;
    readonly format: string;
    readonly quality: string;
}
interface Sound {
    readonly asset: RemoteAsset;
    readonly previews: JsonRecord;
}
const API_ORIGIN = 'https://freesound.org';
const SOUND_ID_PATTERN = /^\d{1,12}$/;
const SOUND_FIELDS = 'id,name,tags,username,license,duration,type,filesize,previews,images,url';
const TAG_LIMIT = 12;
const DURATION_PRECISION = 100;
const FALLBACK_AUTHOR = 'Unknown author';
const PREVIEWS: readonly Preview[] = [
    { key: 'preview-hq-mp3', format: 'mp3', quality: 'hq' },
    { key: 'preview-hq-ogg', format: 'ogg', quality: 'hq' },
    { key: 'preview-lq-mp3', format: 'mp3', quality: 'lq' },
    { key: 'preview-lq-ogg', format: 'ogg', quality: 'lq' },
];
function authorize(session: SourceSession): RequestHeaders {
    return { Authorization: `Token ${session.apiKey}` };
}
function roundDuration(seconds: number | null): number | null {
    return seconds === null ? null : Math.round(seconds * DURATION_PRECISION) / DURATION_PRECISION;
}
function parseSound(value: unknown): Sound | null {
    if (!isRecord(value))
        return null;
    const numericId = numberAt(value, 'id');
    if (numericId === null || !Number.isSafeInteger(numericId) || numericId < 0)
        return null;
    const id = String(numericId);
    const asset: RemoteAsset = {
        id,
        kind: 'audio',
        name: textAt(value, 'name') || id,
        author: textAt(value, 'username') || FALLBACK_AUTHOR,
        license: licenseLabelFromUrl(textAt(value, 'license')),
        pageUrl: httpsUrlAt(value, 'url')?.href ?? `${API_ORIGIN}/s/${id}/`,
        thumbnailUrl: httpsUrlAt(recordAt(value, 'images') ?? {}, 'waveform_m'),
        tags: textsAt(value, 'tags').slice(0, TAG_LIMIT),
        facts: collectFacts({ durationSeconds: roundDuration(numberAt(value, 'duration')), originalFormat: textAt(value, 'type'), originalBytes: numberAt(value, 'filesize') }),
    };
    return { asset, previews: recordAt(value, 'previews') ?? {} };
}
function listVariants(previews: JsonRecord): AssetVariant[] {
    return PREVIEWS.filter(({ key }) => httpsUrlAt(previews, key) !== null).map(({ format, quality }) => ({ format, quality, bytes: null }));
}
async function requestSound(assetId: string, session: SourceSession): Promise<Sound> {
    if (!SOUND_ID_PATTERN.test(assetId))
        throw new ToolFailure(`"${assetId}" is not a Freesound sound id. Use the "ref" of a search_assets result.`);
    const url = new URL(`/apiv2/sounds/${assetId}/`, API_ORIGIN);
    url.searchParams.set('fields', SOUND_FIELDS);
    const sound = parseSound(await requestJson(url, authorize(session)));
    if (!sound)
        throw new ToolFailure(`Freesound sent an unexpected answer for the sound "${assetId}".`);
    return sound;
}
async function search(query: AssetSearchQuery, session: SourceSession): Promise<AssetSearchPage> {
    const url = new URL('/apiv2/search/text/', API_ORIGIN);
    url.searchParams.set('query', query.text);
    url.searchParams.set('page', String(query.page));
    url.searchParams.set('page_size', String(query.limit));
    url.searchParams.set('fields', SOUND_FIELDS);
    const body = await requestJson(url, authorize(session));
    if (!isRecord(body))
        throw new ToolFailure('Freesound sent an unexpected search answer.');
    return { assets: listAt(body, 'results').flatMap((result) => parseSound(result)?.asset ?? []), hasMore: textAt(body, 'next') !== '' };
}
async function describe(_kind: RemoteAssetKind, assetId: string, session: SourceSession): Promise<AssetDetails> {
    const { asset, previews } = await requestSound(assetId, session);
    return { asset, variants: listVariants(previews) };
}
async function resolvePackage(_kind: RemoteAssetKind, assetId: string, choice: VariantChoice, session: SourceSession): Promise<AssetPackage> {
    const { asset, previews } = await requestSound(assetId, session);
    const variant = chooseVariant(listVariants(previews), choice, asset.name);
    const preview = PREVIEWS.find(({ format, quality }) => format === variant.format && quality === variant.quality);
    const url = preview ? httpsUrlAt(previews, preview.key) : null;
    if (!url)
        throw new ToolFailure(`Freesound offers no ${variant.format} preview for "${asset.name}".`);
    return { asset, variant, files: [{ url, name: safeFileName(asset.name, variant.format), bytes: null, slots: [] }] };
}
export const FREESOUND: AssetSource = {
    id: 'freesound',
    label: 'Freesound',
    homepage: API_ORIGIN,
    kinds: ['audio'],
    licensing: 'Licenses vary per sound: CC0, CC BY or CC BY-NC. The files are the MP3 and OGG previews, because originals need a login.',
    credential: { label: 'Chave da API', helpUrl: 'https://freesound.org/apiv2/apply' },
    search,
    describe,
    resolvePackage,
};
