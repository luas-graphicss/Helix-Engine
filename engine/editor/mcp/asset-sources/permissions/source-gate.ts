import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import type { AssetSource, RemoteAssetKind, SourceSession } from '../catalog/asset-source';
import { ASSET_SOURCES, findAssetSource } from '../catalog/source-catalog';
import { permissionOf, readinessOf, type SourcePermissions } from './source-permissions';
const PANEL_HINT = 'in the Assistant panel, under MCP, in "Fontes de assets"';
export interface OpenSource {
    readonly source: AssetSource;
    readonly session: SourceSession;
}
export function openSource(permissions: SourcePermissions, sourceId: string, kind: RemoteAssetKind): OpenSource {
    const source = findAssetSource(sourceId);
    if (!source)
        throw new ToolFailure(`Unknown asset source "${sourceId}". Sources: ${ASSET_SOURCES.map(({ id }) => id).join(', ')}.`);
    if (!source.kinds.includes(kind))
        throw new ToolFailure(`${source.label} has no ${kind} assets. It offers: ${source.kinds.join(', ')}.`);
    const permission = permissionOf(permissions, source.id);
    switch (readinessOf(source, permission)) {
        case 'blocked':
            throw new ToolFailure(`The user has not allowed ${source.label}. Do not retry. Ask them to switch it on ${PANEL_HINT}.`);
        case 'missingKey':
            throw new ToolFailure(`${source.label} needs an API key that the user has not entered. Do not retry. Ask them to paste it ${PANEL_HINT}. They get one at ${source.credential?.helpUrl ?? source.homepage}.`);
        case 'ready':
            return { source, session: { apiKey: permission.apiKey } };
    }
}
