import { clamp } from '@/engine/core/math/scalar';
import { choice, flag, integer, parameters, text } from '@/engine/editor/assistant/tools/tool-parameters';
import { creditLine, presentAsset, presentVariant } from '@/engine/editor/mcp/asset-sources/catalog/asset-presentation';
import { parseAssetReference } from '@/engine/editor/mcp/asset-sources/catalog/asset-reference';
import { REMOTE_ASSET_KINDS, type RemoteAsset } from '@/engine/editor/mcp/asset-sources/catalog/asset-source';
import { ASSET_SOURCES } from '@/engine/editor/mcp/asset-sources/catalog/source-catalog';
import { openSource } from '@/engine/editor/mcp/asset-sources/permissions/source-gate';
import { permissionOf, readinessOf } from '@/engine/editor/mcp/asset-sources/permissions/source-permissions';
import { renderAssetPreviewSheet } from '@/engine/editor/mcp/asset-sources/preview/asset-preview-sheet';
import type { ToolAttachment } from '@/engine/mcp/protocol/bridge-messages';
import type { FileTransfer } from './file-transfer';
import type { McpTool } from './mcp-tool';
const SOURCE_IDS: readonly string[] = ASSET_SOURCES.map((source) => source.id);
const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 16;
const PREVIEW_FILE_NAME = 'asset-previews.jpg';
const PERMISSION_NOTE = 'The user allows each source in the Assistant panel, under MCP, and pastes there the API key of the sources that need one.';
async function attachPreviews(files: FileTransfer, assets: readonly RemoteAsset[]): Promise<ToolAttachment[]> {
    return assets.length > 0 ? [await files.upload(await renderAssetPreviewSheet(assets), PREVIEW_FILE_NAME)] : [];
}
const listAssetSources: McpTool = {
    name: 'list_asset_sources',
    title: 'Listar fontes de assets',
    access: 'read',
    description: `Lists the external libraries of 3D models, textures, HDRIs, audio and images, with the kinds each one offers and its status: "ready", "blocked" or "missingKey". Only "ready" sources work. ${PERMISSION_NOTE}`,
    parameters: parameters({}),
    run({ sourcePermissions }) {
        const sources = ASSET_SOURCES.map((source) => ({
            id: source.id,
            name: source.label,
            kinds: source.kinds,
            status: readinessOf(source, permissionOf(sourcePermissions, source.id)),
            needsApiKey: source.credential !== null,
            licensing: source.licensing,
            homepage: source.homepage,
        }));
        return { output: { sources } };
    },
};
const searchAssets: McpTool = {
    name: 'search_assets',
    title: 'Pesquisar assets externos',
    access: 'read',
    description: `Searches one external library and returns the matching assets with author, license and a "ref" for inspect_asset and insert_asset. Attaches one image with the numbered thumbnails so you can see the results before choosing. Audio thumbnails are waveforms. ${PERMISSION_NOTE}`,
    parameters: parameters({
        source: choice('Source id from list_asset_sources.', SOURCE_IDS),
        kind: choice('Kind of asset to look for.', REMOTE_ASSET_KINDS),
        query: text('Search words in English, such as "wooden barrel" or "rain loop".'),
        animated: flag('Models on Sketchfab: keep only the ones with animation clips.'),
        rigged: flag('Models on Sketchfab: keep only the ones with a skeleton.'),
        page: integer('Result page, starting at 1. Default 1.'),
        limit: integer(`Results per page, from 1 to ${MAX_PAGE_SIZE}. Default ${DEFAULT_PAGE_SIZE}.`),
        previews: flag('Attach the image with the thumbnails. Default true.'),
    }, ['source', 'kind', 'query']),
    async run({ sourcePermissions, files }, input) {
        const kind = input.choice('kind', REMOTE_ASSET_KINDS);
        const { source, session } = openSource(sourcePermissions, input.choice('source', SOURCE_IDS), kind);
        const page = Math.max(1, input.optionalInteger('page') ?? 1);
        const found = await source.search({
            kind,
            text: input.text('query').trim(),
            page,
            limit: clamp(input.optionalInteger('limit') ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
            animatedOnly: input.optionalFlag('animated') ?? false,
            riggedOnly: input.optionalFlag('rigged') ?? false,
        }, session);
        const attachments = (input.optionalFlag('previews') ?? true) ? await attachPreviews(files, found.assets) : [];
        const results = found.assets.map((asset, index) => ({ number: index + 1, ...presentAsset(source.id, asset) }));
        return { output: { source: source.id, kind, page, hasMore: found.hasMore, results }, attachments };
    },
};
const inspectAsset: McpTool = {
    name: 'inspect_asset',
    title: 'Inspecionar asset externo',
    access: 'read',
    description: 'Describes one external asset before inserting it: author, license, the credit line to show when the license requires it, and every format and quality available with its size. Attaches the thumbnail. Pass the chosen format and quality to insert_asset.',
    parameters: parameters({
        asset: text('Asset reference: the "ref" of a search_assets result.'),
        preview: flag('Attach the thumbnail. Default true.'),
    }, ['asset']),
    async run({ sourcePermissions, files }, input) {
        const reference = parseAssetReference(input.text('asset'));
        const { source, session } = openSource(sourcePermissions, reference.sourceId, reference.kind);
        const { asset, variants } = await source.describe(reference.kind, reference.assetId, session);
        const attachments = (input.optionalFlag('preview') ?? true) ? await attachPreviews(files, [asset]) : [];
        return { output: { ...presentAsset(source.id, asset), credit: creditLine(asset), variants: variants.map(presentVariant) }, attachments };
    },
};
export const ASSET_DISCOVERY_TOOLS: readonly McpTool[] = [listAssetSources, searchAssets, inspectAsset];
