import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { REMOTE_ASSET_KINDS, type RemoteAssetKind } from './asset-source';
const SEPARATOR = ':';
export interface AssetReference {
    readonly sourceId: string;
    readonly kind: RemoteAssetKind;
    readonly assetId: string;
}
export function formatAssetReference({ sourceId, kind, assetId }: AssetReference): string {
    return [sourceId, kind, assetId].join(SEPARATOR);
}
export function parseAssetReference(reference: string): AssetReference {
    const [sourceId, kindText, ...idParts] = reference.trim().split(SEPARATOR);
    const kind = REMOTE_ASSET_KINDS.find((candidate) => candidate === kindText);
    const assetId = idParts.join(SEPARATOR);
    if (!sourceId || !kind || !assetId)
        throw new ToolFailure(`"${reference}" is not an asset reference. Pass the "ref" of a search_assets result, in the form source:kind:id.`);
    return { sourceId, kind, assetId };
}
