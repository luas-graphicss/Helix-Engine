import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { isFiniteNumber, isRecord, type JsonRecord } from '@/engine/mcp/protocol/json-shape';
import { collectFacts } from '../../catalog/asset-facts';
import type { AssetDetails, AssetPackage, AssetSearchPage, AssetSearchQuery, AssetSource, RemoteAsset, RemoteAssetKind, VariantChoice } from '../../catalog/asset-source';
import { chooseVariant } from '../../catalog/variant-selection';
import { httpsUrlAt, listAt, numberAt, recordAt, textAt, textsAt } from '../../transport/json-reading';
import { requestJson } from '../../transport/source-request';
import { listPolyHavenVariants, resolvePolyHavenFiles, type PolyHavenKind } from './poly-haven-files';
interface CatalogEntry {
    readonly asset: RemoteAsset;
    readonly searchText: string;
    readonly downloads: number;
}
interface Catalog {
    readonly loadedAt: number;
    readonly entries: readonly CatalogEntry[];
}
const API_ORIGIN = 'https://api.polyhaven.com';
const SITE_ORIGIN = 'https://polyhaven.com';
const ASSET_ID_PATTERN = /^[A-Za-z0-9_.-]{1,96}$/;
const CATALOG_TTL_MS = 10 * 60 * 1000;
const LICENSE = 'CC0';
const FALLBACK_AUTHOR = 'Poly Haven';
const CATALOG_TYPE: Record<PolyHavenKind, string> = { model: 'models', texture: 'textures', hdri: 'hdris' };
const catalogs = new Map<PolyHavenKind, Catalog>();
function requirePolyHavenKind(kind: RemoteAssetKind): PolyHavenKind {
    if (kind !== 'model' && kind !== 'texture' && kind !== 'hdri')
        throw new ToolFailure(`Poly Haven has no ${kind} assets. It offers model, texture and hdri.`);
    return kind;
}
function describeResolution(entry: JsonRecord): string | null {
    const [width, height] = listAt(entry, 'max_resolution');
    return isFiniteNumber(width) && isFiniteNumber(height) ? `${width}x${height}` : null;
}
function parseCatalogEntry(kind: PolyHavenKind, id: string, value: unknown): CatalogEntry | null {
    if (!isRecord(value) || !ASSET_ID_PATTERN.test(id))
        return null;
    const name = textAt(value, 'name') || id;
    const tags = [...textsAt(value, 'categories'), ...textsAt(value, 'tags')];
    const authors = Object.keys(recordAt(value, 'authors') ?? {});
    const asset: RemoteAsset = {
        id,
        kind,
        name,
        author: authors.join(', ') || FALLBACK_AUTHOR,
        license: LICENSE,
        pageUrl: `${SITE_ORIGIN}/a/${id}`,
        thumbnailUrl: httpsUrlAt(value, 'thumbnail_url'),
        tags,
        facts: collectFacts({ polygons: numberAt(value, 'polycount'), maxResolution: describeResolution(value) }),
    };
    return { asset, searchText: [id, name, ...tags].join(' ').toLowerCase(), downloads: numberAt(value, 'download_count') ?? 0 };
}
async function loadCatalog(kind: PolyHavenKind): Promise<readonly CatalogEntry[]> {
    const cached = catalogs.get(kind);
    if (cached && Date.now() - cached.loadedAt < CATALOG_TTL_MS)
        return cached.entries;
    const url = new URL('/assets', API_ORIGIN);
    url.searchParams.set('t', CATALOG_TYPE[kind]);
    const body = await requestJson(url);
    if (!isRecord(body))
        throw new ToolFailure('Poly Haven sent an unexpected catalog.');
    const entries = Object.entries(body)
        .flatMap(([id, value]) => parseCatalogEntry(kind, id, value) ?? [])
        .sort((left, right) => right.downloads - left.downloads);
    catalogs.set(kind, { loadedAt: Date.now(), entries });
    return entries;
}
async function findAsset(kind: PolyHavenKind, assetId: string): Promise<RemoteAsset> {
    const entry = ASSET_ID_PATTERN.test(assetId) ? (await loadCatalog(kind)).find(({ asset }) => asset.id === assetId) : undefined;
    if (!entry)
        throw new ToolFailure(`Poly Haven has no ${kind} with the id "${assetId}". Use the "ref" of a search_assets result.`);
    return entry.asset;
}
async function loadFiles(assetId: string): Promise<JsonRecord> {
    const body = await requestJson(new URL(`/files/${encodeURIComponent(assetId)}`, API_ORIGIN));
    if (!isRecord(body))
        throw new ToolFailure(`Poly Haven sent an unexpected file list for "${assetId}".`);
    return body;
}
async function search(query: AssetSearchQuery): Promise<AssetSearchPage> {
    const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (await loadCatalog(requirePolyHavenKind(query.kind))).filter((entry) => terms.every((term) => entry.searchText.includes(term)));
    const start = (query.page - 1) * query.limit;
    return { assets: matches.slice(start, start + query.limit).map((entry) => entry.asset), hasMore: start + query.limit < matches.length };
}
async function describe(kind: RemoteAssetKind, assetId: string): Promise<AssetDetails> {
    const polyHavenKind = requirePolyHavenKind(kind);
    const asset = await findAsset(polyHavenKind, assetId);
    return { asset, variants: listPolyHavenVariants(polyHavenKind, await loadFiles(assetId)) };
}
async function resolvePackage(kind: RemoteAssetKind, assetId: string, choice: VariantChoice): Promise<AssetPackage> {
    const polyHavenKind = requirePolyHavenKind(kind);
    const asset = await findAsset(polyHavenKind, assetId);
    const files = await loadFiles(assetId);
    const variant = chooseVariant(listPolyHavenVariants(polyHavenKind, files), choice, asset.name);
    return { asset, variant, files: resolvePolyHavenFiles(polyHavenKind, files, variant.format, variant.quality ?? '') };
}
export const POLY_HAVEN: AssetSource = {
    id: 'polyhaven',
    label: 'Poly Haven',
    homepage: SITE_ORIGIN,
    kinds: ['model', 'texture', 'hdri'],
    licensing: 'Every asset is CC0: free for any use, credit is optional.',
    credential: null,
    search,
    describe,
    resolvePackage,
};
