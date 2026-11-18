import type { MaterialTextureSlot } from '@/engine/core/scene/material';
export const REMOTE_ASSET_KINDS = ['model', 'texture', 'hdri', 'audio', 'image'] as const;
export type RemoteAssetKind = (typeof REMOTE_ASSET_KINDS)[number];
export type AssetFact = string | number | boolean;
export interface SourceCredential {
    readonly label: string;
    readonly helpUrl: string;
}
export interface SourceSession {
    readonly apiKey: string;
}
export interface AssetSearchQuery {
    readonly kind: RemoteAssetKind;
    readonly text: string;
    readonly page: number;
    readonly limit: number;
    readonly animatedOnly: boolean;
    readonly riggedOnly: boolean;
}
export interface RemoteAsset {
    readonly id: string;
    readonly kind: RemoteAssetKind;
    readonly name: string;
    readonly author: string;
    readonly license: string;
    readonly pageUrl: string;
    readonly thumbnailUrl: URL | null;
    readonly tags: readonly string[];
    readonly facts: Readonly<Record<string, AssetFact>>;
}
export interface AssetSearchPage {
    readonly assets: readonly RemoteAsset[];
    readonly hasMore: boolean;
}
export interface AssetVariant {
    readonly format: string;
    readonly quality: string | null;
    readonly bytes: number | null;
}
export interface AssetDetails {
    readonly asset: RemoteAsset;
    readonly variants: readonly AssetVariant[];
}
export interface VariantChoice {
    readonly format: string | null;
    readonly quality: string | null;
}
export interface RemoteFile {
    readonly url: URL;
    readonly name: string;
    readonly bytes: number | null;
    readonly slots: readonly MaterialTextureSlot[];
}
export interface AssetPackage {
    readonly asset: RemoteAsset;
    readonly variant: AssetVariant;
    readonly files: readonly RemoteFile[];
}
export interface AssetSource {
    readonly id: string;
    readonly label: string;
    readonly homepage: string;
    readonly kinds: readonly RemoteAssetKind[];
    readonly licensing: string;
    readonly credential: SourceCredential | null;
    search(query: AssetSearchQuery, session: SourceSession): Promise<AssetSearchPage>;
    describe(kind: RemoteAssetKind, assetId: string, session: SourceSession): Promise<AssetDetails>;
    resolvePackage(kind: RemoteAssetKind, assetId: string, choice: VariantChoice, session: SourceSession): Promise<AssetPackage>;
}
