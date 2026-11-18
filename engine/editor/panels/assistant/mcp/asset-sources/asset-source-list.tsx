'use client';
import { useSyncExternalStore } from 'react';
import { ASSET_SOURCES } from '@/engine/editor/mcp/asset-sources/catalog/source-catalog';
import { permissionOf } from '@/engine/editor/mcp/asset-sources/permissions/source-permissions';
import type { SourcePermissionsStore } from '@/engine/editor/mcp/asset-sources/permissions/source-permissions-store';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { AssetSourceRow } from './asset-source-row';
type AssetSourceListProps = {
    store: SourcePermissionsStore;
};
export function AssetSourceList({ store }: AssetSourceListProps) {
    const permissions = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    return (<CollapsibleSection title="Fontes de assets" hint="Bibliotecas externas que os agentes pesquisam e inserem no jogo. Nenhuma é usada sem a sua permissão.">
      <ul aria-label="Fontes de assets liberadas para os agentes" className="flex flex-col gap-px">
        {ASSET_SOURCES.map((source) => (<AssetSourceRow key={source.id} source={source} permission={permissionOf(permissions, source.id)} onAllowedChange={(allowed) => store.setAllowed(source.id, allowed)} onApiKeyCommit={(apiKey) => store.setApiKey(source.id, apiKey)}/>))}
      </ul>
    </CollapsibleSection>);
}
